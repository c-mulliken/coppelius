# coppelius

brown has a course review problem. we're solving it with gamified course comparisons: compare courses you've already taken (on difficulty, content, vibes, so on), and get back better course recommendations for yourself and your peers. 

## in action
![Course comparison UI](/assets/comparison.png)

![Revealed ranking UI](/assets/rankings.png)

## behind the scenes

for now, we're using an ELO ranking system for courses, where each comparison a user makes is treated as a match. for a few reasons, we think this is a bit naïve, so we're exploring alternative methods. the goal isn't, however, to create great *global* ratings, but great *personal* ones; i.e., given the courses you've taken and liked, how well can we predict *novel* courses you'd also like. 

## what's under the hood
* backend: **Node.js** + **PostgreSQL**
* frontend: **React** + **Vite**
* deployment: **Vercel** frontend, **Railway** backend
* embeddings: **OpenAI** embedding models

## data + modeling directions
we’re experimenting with:
* personalized embeddings using course tags and user similarity
* Bradley–Terry / Thurstone models for pairwise comparison inference
* collaborative filtering with sparse user–course matrices
goal: move from raw ELO to learned latent preference spaces

## roadmap
- [x] mvp with ELO rankings + functional course comparison
- [ ] personalized recs based on global prefs
- [ ] comparison on alternative axes
- [ ] adaptive sampling
- [ ] social functionality
- [ ] public launch ahead of next sem shopping period (winter 2025)
