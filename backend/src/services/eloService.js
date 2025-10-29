const db = require('../config/db');

// K-factor for Elo calculation (higher = more volatile ratings)
const K_FACTOR = 32;

// Default starting rating
const DEFAULT_RATING = 1500;

/**
 * Calculate expected score for a matchup
 * @param {number} ratingA - Rating of player A
 * @param {number} ratingB - Rating of player B
 * @returns {number} Expected score (0-1) for player A
 */
function calculateExpectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculate new rating based on expected and actual score
 * @param {number} currentRating - Current rating
 * @param {number} expectedScore - Expected score (0-1)
 * @param {number} actualScore - Actual score (1 for win, 0 for loss)
 * @returns {number} New rating (rounded)
 */
function calculateNewRating(currentRating, expectedScore, actualScore) {
  return Math.round(currentRating + K_FACTOR * (actualScore - expectedScore));
}

/**
 * Update Elo ratings for two offerings after a comparison
 * @param {number} winnerOfferingId - ID of the winning offering
 * @param {number} loserOfferingId - ID of the losing offering
 * @param {string} category - Category of comparison (difficulty, enjoyment, engagement)
 * @param {function} callback - Callback function (err)
 */
async function updateEloRatings(winnerOfferingId, loserOfferingId, category, callback) {
  console.log('\n=== ELO UPDATE CALLED ===');
  console.log('Winner ID:', winnerOfferingId, 'Loser ID:', loserOfferingId, 'Category:', category);

  // PostgreSQL implementation
  if (db.pool) {
    try {
      // Get current ratings for this category
      const getRatingSql = `
        SELECT offering_id, category, rating, comparison_count
        FROM offering_ratings
        WHERE offering_id IN ($1, $2) AND category = $3
      `;

      console.log('Fetching current ratings...');
      const result = await db.pool.query(getRatingSql, [winnerOfferingId, loserOfferingId, category]);
      const ratings = result.rows;
      console.log('Current ratings from DB:', JSON.stringify(ratings, null, 2));

      // Initialize ratings if they don't exist
      let winnerRating = DEFAULT_RATING;
      let loserRating = DEFAULT_RATING;
      let winnerCount = 0;
      let loserCount = 0;

      ratings.forEach(r => {
        if (r.offering_id == winnerOfferingId) {
          winnerRating = r.rating;
          winnerCount = r.comparison_count;
        } else if (r.offering_id == loserOfferingId) {
          loserRating = r.rating;
          loserCount = r.comparison_count;
        }
      });

      console.log('Before update - Winner rating:', winnerRating, 'count:', winnerCount);
      console.log('Before update - Loser rating:', loserRating, 'count:', loserCount);

      // Calculate expected scores
      const expectedWinner = calculateExpectedScore(winnerRating, loserRating);
      const expectedLoser = calculateExpectedScore(loserRating, winnerRating);

      console.log('Expected scores - Winner:', expectedWinner, 'Loser:', expectedLoser);

      // Calculate new ratings
      const newWinnerRating = calculateNewRating(winnerRating, expectedWinner, 1);
      const newLoserRating = calculateNewRating(loserRating, expectedLoser, 0);

      console.log('New ratings - Winner:', newWinnerRating, 'Loser:', newLoserRating);
      console.log('Rating changes - Winner:', newWinnerRating - winnerRating, 'Loser:', newLoserRating - loserRating);

      // Update ratings in database
      const upsertSql = `
        INSERT INTO offering_ratings (offering_id, category, rating, comparison_count, updated_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT(offering_id, category) DO UPDATE SET
          rating = EXCLUDED.rating,
          comparison_count = EXCLUDED.comparison_count,
          updated_at = CURRENT_TIMESTAMP
      `;

      console.log('Updating winner in DB...');
      await db.pool.query(upsertSql, [winnerOfferingId, category, newWinnerRating, winnerCount + 1]);
      console.log('Updating loser in DB...');
      await db.pool.query(upsertSql, [loserOfferingId, category, newLoserRating, loserCount + 1]);

      console.log('=== ELO UPDATE COMPLETE ===\n');
      callback(null);
    } catch (err) {
      console.error('!!! ELO UPDATE ERROR !!!', err);
      callback(err);
    }
    return;
  }

  // SQLite fallback
  const getRatingSql = `
    SELECT offering_id, category, rating, comparison_count
    FROM offering_ratings
    WHERE offering_id IN (?, ?) AND category = ?
  `;

  db.all(getRatingSql, [winnerOfferingId, loserOfferingId, category], (err, ratings) => {
    if (err) return callback(err);

    // Initialize ratings if they don't exist
    let winnerRating = DEFAULT_RATING;
    let loserRating = DEFAULT_RATING;
    let winnerCount = 0;
    let loserCount = 0;

    ratings.forEach(r => {
      if (r.offering_id == winnerOfferingId) {
        winnerRating = r.rating;
        winnerCount = r.comparison_count;
      } else if (r.offering_id == loserOfferingId) {
        loserRating = r.rating;
        loserCount = r.comparison_count;
      }
    });

    // Calculate expected scores
    const expectedWinner = calculateExpectedScore(winnerRating, loserRating);
    const expectedLoser = calculateExpectedScore(loserRating, winnerRating);

    // Calculate new ratings
    const newWinnerRating = calculateNewRating(winnerRating, expectedWinner, 1);
    const newLoserRating = calculateNewRating(loserRating, expectedLoser, 0);

    // Update ratings in database
    const upsertSql = `
      INSERT INTO offering_ratings (offering_id, category, rating, comparison_count, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(offering_id, category) DO UPDATE SET
        rating = ?,
        comparison_count = ?,
        updated_at = CURRENT_TIMESTAMP
    `;

    db.run(upsertSql, [winnerOfferingId, category, newWinnerRating, winnerCount + 1, newWinnerRating, winnerCount + 1], (err) => {
      if (err) return callback(err);

      db.run(upsertSql, [loserOfferingId, category, newLoserRating, loserCount + 1, newLoserRating, loserCount + 1], callback);
    });
  });
}

module.exports = {
  updateEloRatings,
  calculateExpectedScore,
  calculateNewRating,
  K_FACTOR,
  DEFAULT_RATING
};
