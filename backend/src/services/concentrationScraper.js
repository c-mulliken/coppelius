const axios = require('axios');
const cheerio = require('cheerio');

const BULLETIN_URL = 'https://bulletin.brown.edu/the-college/concentrations/';

/**
 * Scrape concentrations from Brown bulletin
 * @returns {Promise<Array<string>>} Array of concentration names
 */
async function scrapeConcentrations() {
  try {
    const response = await axios.get(BULLETIN_URL);
    const $ = cheerio.load(response.data);

    const concentrations = [];

    // Find all concentration links in the list
    $('ul.sc-list-group li a').each((i, elem) => {
      const name = $(elem).text().trim();
      if (name) {
        concentrations.push(name);
      }
    });

    // If the above selector doesn't work, try alternative selectors
    if (concentrations.length === 0) {
      $('.concentrations-list a, .content a, #concentrations a').each((i, elem) => {
        const name = $(elem).text().trim();
        if (name && !name.includes('Top') && !name.includes('Skip')) {
          concentrations.push(name);
        }
      });
    }

    console.log(`Scraped ${concentrations.length} concentrations`);
    return concentrations.sort();
  } catch (error) {
    console.error('Error scraping concentrations:', error.message);
    // Return fallback list if scraping fails
    return getFallbackConcentrations();
  }
}

/**
 * Get fallback list of concentrations
 * @returns {Array<string>} Array of concentration names
 */
function getFallbackConcentrations() {
  return [
    'Africana Studies',
    'American Studies',
    'Anthropology',
    'Applied Mathematics',
    'Applied Mathematics-Biology',
    'Applied Mathematics-Computer Science',
    'Applied Mathematics-Economics',
    'Archaeology and the Ancient World',
    'Architecture',
    'Astronomy',
    'Behavioral Decision Sciences',
    'Biochemistry & Molecular Biology',
    'Biology',
    'Biomedical Engineering',
    'Biophysics',
    'Chemical Engineering',
    'Chemical Physics',
    'Chemistry',
    'Classics',
    'Cognitive Neuroscience',
    'Cognitive Science',
    'Comparative Literature',
    'Computational Biology',
    'Computational Neuroscience',
    'Computer Engineering',
    'Computer Science',
    'Computer Science-Economics',
    'Contemplative Studies',
    'Critical Native American and Indigenous Studies',
    'Design Engineering',
    'Early Modern World',
    'Earth and Planetary Science',
    'Earth, Climate, and Biology',
    'East Asian Studies',
    'Economics',
    'Education Studies',
    'Egyptology and Assyriology',
    'Electrical Engineering',
    'Engineering',
    'Engineering and Physics',
    'English',
    'Environmental Engineering',
    'Environmental Sciences and Studies',
    'Ethnic Studies',
    'French and Francophone Studies',
    'Gender and Sexuality Studies',
    'Geochemistry and Environmental Chemistry',
    'Geophysics and Climate Physics',
    'German Studies',
    'Health & Human Biology',
    'Hispanic Literatures and Cultures',
    'History',
    'History of Art and Architecture',
    'Independent Concentration',
    'International and Public Affairs',
    'Italian Studies',
    'Judaic Studies',
    'Latin American and Caribbean Studies',
    'Linguistics',
    'Literary Arts',
    'Materials Engineering',
    'Mathematics',
    'Mathematics-Computer Science',
    'Mathematics-Economics',
    'Mechanical Engineering',
    'Medieval Cultures',
    'Middle East Studies',
    'Modern Culture and Media',
    'Music',
    'Neuroscience',
    'Philosophy',
    'Physics',
    'Physics and Philosophy',
    'Political Science',
    'Portuguese and Brazilian Studies',
    'Psychology',
    'Public Health',
    'Religious Studies',
    'Science, Technology, and Society',
    'Slavic Studies',
    'Social Analysis and Research',
    'Sociology',
    'South Asian Studies',
    'Statistics',
    'Theatre Arts and Performance Studies',
    'Urban Studies',
    'Visual Art'
  ];
}

// Run if called directly
if (require.main === module) {
  scrapeConcentrations().then(concentrations => {
    console.log('Concentrations:');
    concentrations.forEach(c => console.log(`  - ${c}`));
  });
}

module.exports = { scrapeConcentrations, getFallbackConcentrations };
