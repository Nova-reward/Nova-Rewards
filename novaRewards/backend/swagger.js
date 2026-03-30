const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'NovaRewards API',
      version: '1.0.0',
      description:
        'REST API for the Nova Rewards blockchain loyalty platform. ' +
        'All protected endpoints require a Bearer JWT obtained from `POST /auth/login`. ' +
        'Merchant endpoints require an `x-api-key` header instead.',
      contact: { name: 'Nova Rewards Team' },
      license: { name: 'MIT' },
    },
    servers: [
      { url: 'http://localhost:3001/api', description: 'Local development' },
      { url: 'https://api.novarewards.io/api', description: 'Production' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token obtained from `POST /auth/login`.',
        },
        merchantApiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'Merchant API key returned on registration (shown once).',
        },
      },
      schemas: {
        SuccessEnvelope: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'validation_error' },
            message: { type: 'string', example: 'walletAddress is required' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 42 },
            email: { type: 'string', format: 'email', example: 'alice@example.com' },
            first_name: { type: 'string', example: 'Alice' },
            last_name: { type: 'string', example: 'Smith' },
            role: { type: 'string', enum: ['user', 'admin'], example: 'user' },
            created_at: { type: 'string', format: 'date-time', example: '2025-01-15T10:30:00Z' },
          },
        },
        AuthTokens: {
          type: 'object',
          properties: {
            accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            user: { $ref: '#/components/schemas/User' },
          },
        },
        Merchant: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 7 },
            name: { type: 'string', example: 'Stellar Coffee Co.' },
            wallet_address: { type: 'string', example: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN' },
            business_category: { type: 'string', example: 'Food & Beverage' },
            created_at: { type: 'string', format: 'date-time', example: '2025-02-01T08:00:00Z' },
          },
        },
        Campaign: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 3 },
            merchant_id: { type: 'integer', example: 7 },
            name: { type: 'string', example: 'Summer Loyalty Drive' },
            reward_rate: { type: 'number', example: 1.5 },
            start_date: { type: 'string', format: 'date', example: '2025-06-01' },
            end_date: { type: 'string', format: 'date', example: '2025-08-31' },
            is_active: { type: 'boolean', example: true },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 101 },
            tx_hash: { type: 'string', example: 'a1b2c3d4e5f6...' },
            tx_type: { type: 'string', enum: ['distribution', 'redemption', 'transfer'], example: 'distribution' },
            amount: { type: 'number', example: 50.0 },
            from_wallet: { type: 'string', example: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN' },
            to_wallet: { type: 'string', example: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5' },
            stellar_ledger: { type: 'integer', example: 48293847 },
            created_at: { type: 'string', format: 'date-time', example: '2025-03-10T14:22:00Z' },
          },
        },
        Redemption: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 55 },
            user_id: { type: 'integer', example: 42 },
            reward_id: { type: 'integer', example: 12 },
            created_at: { type: 'string', format: 'date-time', example: '2025-03-15T09:00:00Z' },
          },
        },
        Drop: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            title: { type: 'string', example: 'Genesis Drop' },
            amount: { type: 'number', example: 100 },
            merkle_root: { type: 'string', nullable: true, example: null },
            expires_at: { type: 'string', format: 'date-time', example: '2025-12-31T23:59:59Z' },
          },
        },
        ContractEvent: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 200 },
            contract_id: { type: 'string', example: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM' },
            event_type: { type: 'string', enum: ['mint', 'claim', 'stake', 'unstake'], example: 'mint' },
            payload: { type: 'object', example: { to: 'GAAZI4...', amount: 500 } },
            ledger: { type: 'integer', example: 48293847 },
            created_at: { type: 'string', format: 'date-time', example: '2025-03-20T11:00:00Z' },
          },
        },
        EmailLog: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 300 },
            recipient_email: { type: 'string', format: 'email', example: 'alice@example.com' },
            email_type: { type: 'string', enum: ['redemption_confirmation', 'milestone_achieved', 'welcome', 'password_reset'], example: 'welcome' },
            status: { type: 'string', enum: ['queued', 'sent', 'delivered', 'failed'], example: 'delivered' },
            created_at: { type: 'string', format: 'date-time', example: '2025-03-21T07:00:00Z' },
          },
        },
        LeaderboardEntry: {
          type: 'object',
          properties: {
            rank: { type: 'integer', example: 1 },
            user_id: { type: 'integer', example: 42 },
            display_name: { type: 'string', example: 'Alice S.' },
            points: { type: 'number', example: 4200 },
          },
        },
        AdminStats: {
          type: 'object',
          properties: {
            total_users: { type: 'integer', example: 1500 },
            total_points_issued: { type: 'number', example: 750000 },
            total_redemptions: { type: 'integer', example: 320 },
            active_rewards: { type: 'integer', example: 18 },
          },
        },
        Reward: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 12 },
            name: { type: 'string', example: '10% Off Voucher' },
            cost: { type: 'integer', example: 500 },
            stock: { type: 'integer', nullable: true, example: 100 },
            is_active: { type: 'boolean', example: true },
          },
        },
      },
    },
  },
  apis: ['./routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
