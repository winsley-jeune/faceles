# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Viral Faceless Shorts Generator is an AI-powered video generation platform that creates viral short-form content for YouTube, TikTok, Facebook, and Instagram. The system uses analytics-driven topic generation, AI-powered voiceovers, image generation, and automated posting.

## Architecture

### Monorepo Structure

This is a multi-service application with three main components:

1. **trendscraper/** - Backend API server (Node.js/Express)
2. **dashboard/** - Frontend web UI (React + Vite)
3. **PostgreSQL** - Database (via Docker)

### Backend Architecture (trendscraper/src)

The backend follows an **MVC architecture** with the following layers:

- **app.js** - Express app configuration, middleware chain, rate limiting
- **index.js** - Server entry point, startup procedures, graceful shutdown
- **routes/** - Express route definitions (maps URLs to controllers)
- **controllers/** - Request handlers (handle HTTP req/res, call services/modules)
- **services/** - Background services (autoScheduler for batch video generation)
- **modules/** - Core business logic organized by feature:
  - **analytics/** - Platform analytics, viral intelligence, pattern detection, A/B testing
  - **uploaders/** - Platform-specific upload implementations (Playwright-based and API-based)
  - **auth/** - OAuth handling, token management, JWT auth
  - **monetization/** - Subscription/affiliate system
  - Core modules: storyboard.js, renderer.js, voice_pro.js, visuals_pro.js, subtitle_sync.js
- **middleware/** - Express middleware (error handling, auth, async wrappers)
- **config/** - Environment configuration and validation
- **database/** - PostgreSQL connection and schema
- **utils/** - Shared utilities (logging, file operations)

### Frontend Architecture (dashboard/src)

React SPA with the following structure:

- **pages/** - Route components
  - Core: Dashboard, CreateVideo, Analytics, Videos, Publish, Settings
  - Training/Product: TrainingVideoGenerator, ProductVideoGenerator, BrandSettings, PromoSettings
  - Intelligence: ABTesting, ExplorationConfig
  - Auth: Login, AuthCallback, Onboarding
  - Social: SocialConnections
  - Monetization: Monetization page
  - Landing: Home page
- **context/** - React Context providers (AuthContext for JWT authentication)
- **hooks/** - Custom React hooks (usePlatformStatus)
- **api.js** - Centralized API client with axios

### Data Flow

1. **Topic Generation**: Analytics modules analyze platform performance → Generate viral-optimized topics
2. **Video Generation**: Storyboard → Voice generation → Visual generation → Rendering → Subtitle sync
3. **Upload**: Unified uploader dispatches to platform-specific uploaders (API or Playwright)
4. **Analytics Loop**: Fetch platform stats → Update winning patterns → Refine future topics

### Key Subsystems

**Smart Topic Generation**
- Platform-specific generators (smart_youtube_generator.js, smart_tiktok_generator.js, smart_facebook_generator.js, smart_instagram_generator.js)
- Analyzes historical performance to generate viral topics
- Uses viral_intelligence.js for pattern matching and exploration_config.js for exploration vs exploitation
- cross_platform_intelligence.js for insights across all platforms

**Variation Engine**
- variation_engine.js creates A/B test variations
- ab_testing.js tracks experiment results
- Automatically kills losing patterns and doubles down on winners

**Multi-Platform Upload**
- API-based uploaders (youtube_api_uploader.js, tiktok_api_uploader.js, facebook_api_uploader.js, instagram_api_uploader.js) for authenticated uploads
- Playwright-based uploaders (youtube_uploader.js, tiktok_uploader.js, facebook_uploader.js, instagram_uploader.js) as fallback
- unified_uploader.js orchestrates platform selection and routing

**Authentication**
- JWT-based auth with refresh tokens
- OAuth integration for YouTube, TikTok, Facebook, Instagram
- Token blacklist (tokenBlacklist.js) and audit logging (auditLogger.js) for security

**Specialized Content Generators**
- product_video_generator.js - Product showcase videos
- training_video_generator.js - Educational/training content
- avatar_presenter.js - Avatar-based presentations
- promo_topic_generator.js - Promotional content
- document_to_video.js - Document conversion to video
- promo_brand_context.js - Brand-aware promotional content

**Analytics Modules**
- youtube_analytics.js - YouTube video performance tracking
- tiktok_analytics.js - TikTok video analytics
- facebook_analytics.js - Facebook/Meta analytics
- instagram_analytics.js - Instagram analytics
- viral_intelligence.js - Cross-platform viral pattern detection
- cross_platform_intelligence.js - Multi-platform insights aggregation
- performance_weights.js - Dynamic performance scoring
- retention_optimizer.js - Audience retention analysis

## Development Commands

### Docker (Recommended)

```bash
# Start all services (backend + frontend + database)
docker-compose up

# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f trendscraper
docker-compose logs -f dashboard

# Rebuild after dependency changes
docker-compose up --build

# Stop all services
docker-compose down
```

**Service URLs:**
- Backend API: http://localhost:3000
- Frontend Dashboard: http://localhost:5174
- PostgreSQL: localhost:5432

### Backend Development (trendscraper/src)

```bash
cd trendscraper/src

# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Start server (requires .env configuration)
node index.js
```

### Frontend Development (dashboard)

```bash
cd dashboard

# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

### OAuth Login Helper

For local development with Playwright-based uploaders:

```bash
# Login to specific platform
npm run login:youtube
npm run login:tiktok
npm run login:instagram
npm run login:facebook

# Login to all platforms
npm run login:all

# Check login status
npm run check
```

## Environment Configuration

### Required Environment Variables

**Backend (.env in root and trendscraper/src/.env):**

```
# API Keys
GEMINI_API_KEY=your_gemini_api_key
REPLICATE_API_TOKEN=your_replicate_token
ELEVENLABS_API_KEY=your_elevenlabs_key  # Optional for voice

# OAuth - YouTube
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_client_secret

# OAuth - TikTok
TIKTOK_CLIENT_KEY=your_client_key
TIKTOK_CLIENT_SECRET=your_client_secret

# OAuth - Facebook
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret

# JWT Auth (NEVER use default in production)
JWT_SECRET=generate_with_openssl_rand_hex_32

# Database
USE_DATABASE=false  # Set to true to enable PostgreSQL
DATABASE_URL=postgresql://user:pass@localhost:5432/viral_shorts
```

**Frontend (dashboard/.env):**

```
VITE_API_URL=http://localhost:3000
```

### Security Notes

- JWT_SECRET must be at least 32 characters in production
- The system validates JWT_SECRET strength on startup
- Never commit .env files (already in .gitignore)

## Database

### Schema

The PostgreSQL schema (trendscraper/src/database/schema.sql) includes:

- **users** - User accounts with OAuth providers
- **subscriptions** - Monetization/subscription plans
- **platform_tokens** - OAuth tokens per platform per user
- **topics** - Generated topics with performance tracking
- **video_analytics** - Time-series analytics snapshots
- **winning_patterns** - Identified viral patterns
- **ab_experiments** - A/B test experiments and results
- **post_queue** - Scheduled video posts

### Migrations

The database auto-initializes on first run via Docker entrypoint. Schema is in `trendscraper/src/database/schema.sql`.

To manually initialize:

```bash
docker-compose exec postgres psql -U postgres -d viral_shorts -f /docker-entrypoint-initdb.d/01-schema.sql
```

### Hybrid Storage

The system supports both PostgreSQL and JSON file storage:

- Set `USE_DATABASE=true` to use PostgreSQL
- Set `USE_DATABASE=false` to use JSON files in `/data` directory
- Falls back to JSON if database connection fails

## Testing

### Backend Tests

Tests use Vitest framework:

```bash
cd trendscraper/src

# Run all tests
npm test

# Watch mode (auto-reruns on file changes)
npm run test:watch

# Coverage report
npm run test:coverage

# Run specific test file
npx vitest run path/to/test.test.js

# Run tests matching pattern
npx vitest run --grep "pattern"
```

Test files are located in:
- `__tests__/` directories
- `*.test.js` files adjacent to source

Test configuration: `trendscraper/src/vitest.config.js`

### E2E and Security Tests

Manual test scripts in `trendscraper/src/`:
- `test_e2e_free.js` - E2E test with free image generation
- `test_comprehensive_e2e.js` - Full pipeline test
- `test_oauth_security.js` - OAuth security validation
- `test_renderer_security.js` - Renderer security checks
- `test_security_fixes.js` - Security regression tests

## API Endpoints

### Smart Generation

- `POST /smart/generate` - Generate video with AI topic (general)
- `POST /smart/generate-topic` - Generate topic only
- `POST /smart/batch` - Generate multiple videos

### Platform-Specific Smart Generation

- `POST /tiktok/smart/generate` - TikTok-optimized generation
- `POST /facebook/smart/generate` - Facebook-optimized generation
- `POST /instagram/smart/generate` - Instagram-optimized generation

### Platform API Endpoints

Each platform has OAuth and upload endpoints:

- `/youtube-api/auth` - Start OAuth flow
- `/youtube-api/callback` - OAuth callback
- `/youtube-api/upload` - Upload to YouTube
- `/youtube-api/status` - Connection status
- (Similar patterns for /tiktok-api, /facebook-api, /instagram-api)

### Analytics

- `GET /analytics/youtube` - YouTube analytics
- `GET /analytics/tiktok` - TikTok analytics
- `GET /analytics/facebook` - Facebook analytics
- `GET /analytics/instagram` - Instagram analytics
- `GET /analytics/patterns` - Winning patterns
- `GET /analytics/topics` - Topic performance
- `POST /analytics/refresh` - Refresh analytics

### A/B Testing

- `POST /ab-testing/experiments` - Create experiment
- `GET /ab-testing/experiments` - List experiments
- `POST /ab-testing/assign` - Assign variant to video
- `POST /ab-testing/record` - Record performance

### Variations

- `POST /variations/create` - Create topic variations
- `GET /variations/queue` - Get variation queue
- `POST /variations/generate` - Generate video from variation

### Content Management

- `POST /brand` - Manage brand settings and context
- `POST /promo` - Configure promotional content settings
- `POST /training` - Training video generation endpoints
- `POST /product` - Product video generation
- `POST /avatar` - Avatar presenter video generation
- `POST /clone` - Clone successful video patterns
- `GET /virals` - Get viral video patterns
- `POST /batch` - Batch video generation
- `GET /exploration` - Get/update exploration config
- `GET /videos` - List generated videos
- `GET /social` - Social media connection status

### Monetization

- `POST /monetization/subscribe` - Create subscription
- `POST /monetization/affiliate/create` - Create affiliate
- `GET /monetization/affiliate/dashboard` - Affiliate stats

## Important Technical Details

### Rate Limiting

The API has three rate limit tiers (configured in app.js):
- General API: 100 requests per 15 minutes
- Auth endpoints: 10 requests per 15 minutes
- Video generation: 20 videos per hour

### Authentication Flow

1. User logs in via OAuth (Google/TikTok/Facebook)
2. Backend creates user in database
3. Returns JWT access token + refresh token
4. Frontend stores tokens in localStorage
5. All API requests include JWT in Authorization header
6. Optional auth middleware allows unauthenticated requests for backwards compatibility

### Video Generation Pipeline

1. **Topic Selection** - Smart generator picks topic based on analytics
2. **Storyboard** - Break topic into scenes with hooks/body/CTA
3. **Voice** - Generate voiceover
   - voice_pro.js - Primary voice module (supports ElevenLabs, edge-tts)
   - voice_free.js - Free alternative using edge-tts only
   - Multiple backup implementations available (voice_pro_backup.js, voice_pro_elevenlabs_only.js)
4. **Visuals** - Generate images
   - visuals_pro.js - Uses Replicate API for high-quality images
   - free_image_generator.js - Free alternative using public APIs
5. **Subtitles** - Sync subtitles to audio with subtitle_sync.js
6. **Rendering** - Composite video with renderer.js (uses FFmpeg)
7. **Upload** - Post to platforms via unified_uploader.js

### Startup Sequence

On server startup (index.js):
1. **Validate environment variables** - Ensures all required API keys and config are present
2. **Initialize database connection** - Connects to PostgreSQL if USE_DATABASE=true, falls back to JSON if failed
3. **Refresh analytics** - Automatically fetches fresh YouTube analytics to calculate viral thresholds and identify top performers
4. **Start auto-scheduler** - Background service begins processing scheduled posts from post_queue
5. **Server is ready** - Listens on port 3000 (configurable via PORT env var)

### Auto-Scheduler

Background service (services/autoScheduler.js) that:
- Processes scheduled posts from post_queue
- Runs on configurable intervals
- Automatically generates and posts videos based on schedule

## Common Patterns

### MVC Architecture Guidelines

When adding new features, follow the MVC structure:

1. **Routes** (`routes/`) - Define URL endpoints, apply middleware
2. **Controllers** (`controllers/`) - Handle HTTP requests/responses, call services
3. **Services** (`services/`) - Background jobs, scheduled tasks
4. **Modules** (`modules/`) - Core business logic (analytics, uploaders, generators)
5. **Middleware** (`middleware/`) - Request processing, auth, error handling
6. **Config** (`config/`) - Environment variables, validation
7. **Utils** (`utils/`) - Shared utilities (logging, file operations)

**Key principle**: Controllers are thin - they handle req/res and delegate to modules/services for business logic.

### Adding a New Platform

1. Create analytics module in `modules/analytics/{platform}_analytics.js`
2. Create smart generator in `modules/analytics/smart_{platform}_generator.js`
3. Create API uploader in `modules/uploaders/{platform}_api_uploader.js`
4. Create Playwright uploader in `modules/uploaders/{platform}_uploader.js` (fallback)
5. Create routes in `routes/{platform}Routes.js`
6. Create controller in `controllers/{platform}Controller.js`
7. Add platform to unified_uploader.js
8. Add OAuth configuration to config/env.js
9. Update database schema for platform tokens
10. Mount routes in `routes/index.js`

### Adding a New API Endpoint

1. Create controller method in `controllers/`
2. Add route in appropriate route file in `routes/`
3. Apply middleware (auth, rate limiting) in app.js if needed
4. Update CLAUDE.md API documentation

### Analytics-Driven Development

All new features should integrate with the analytics loop:
- Track performance metrics
- Feed data into winning_patterns
- Use viral_intelligence.js to optimize future content
- Consider A/B testing for significant changes

## Troubleshooting

### Database Connection Issues

If database fails to connect, the system falls back to JSON file storage. Check:
- `USE_DATABASE=true` in .env
- PostgreSQL container is running: `docker-compose ps`
- Database credentials match docker-compose.yml

### OAuth Callback Issues

OAuth callbacks require correct redirect URIs:
- Development: http://localhost:3000/{platform}-api/callback
- Production: Must match OAuth app configuration
- TikTok uses ports 8087, Facebook 8086, YouTube 8085 (see docker-compose.yml)

### Video Generation Failures

Common issues:
- Missing API keys (GEMINI_API_KEY, REPLICATE_API_TOKEN)
- FFmpeg not available in container
- Insufficient disk space in /videos directory
- Rate limit exceeded on external APIs

### Frontend Not Connecting to Backend

Check:
- Backend is running on port 3000
- VITE_API_URL is set correctly in dashboard/.env
- CORS is enabled (configured in app.js)
- No port conflicts with other services
