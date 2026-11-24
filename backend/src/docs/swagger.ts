import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'OutreachFlow API',
    version: '1.0.0',
    description: 'AI Cold-Email Campaign Tool REST API with database-backed queue, Gemini AI personalization, sandbox sending, and open tracking.',
    contact: {
      name: 'Raj Kiran Acharyya',
      url: 'https://github.com/RajKiranAcharyya/outreachflow-ai-campaigns',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local Development Server',
    },
  ],
  components: {
    securitySchemes: {
      AdminTokenAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-admin-token',
        description: 'Admin authentication token header',
      },
    },
    schemas: {
      Contact: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          email: { type: 'string', format: 'email' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          company: { type: 'string' },
          role: { type: 'string' },
          note: { type: 'string' },
          status: { type: 'string', enum: ['active', 'unsubscribed'] },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      CampaignStep: {
        type: 'object',
        properties: {
          step_number: { type: 'integer', example: 1 },
          delay_minutes: { type: 'integer', example: 0 },
          subject_template: { type: 'string', example: 'Quick question about {{company}}' },
          body_template: { type: 'string', example: 'Hi {{first_name}}, {{ai_opening}}' },
        },
      },
      Campaign: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          status: { type: 'string', enum: ['active', 'draft', 'paused', 'completed'] },
          daily_limit: { type: 'integer', example: 50 },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      DashboardStats: {
        type: 'object',
        properties: {
          totalContacts: { type: 'integer' },
          activeCampaigns: { type: 'integer' },
          sent: { type: 'integer' },
          failed: { type: 'integer' },
          pending: { type: 'integer' },
          opened: { type: 'integer' },
          openRate: { type: 'string', example: '42%' },
        },
      },
    },
  },
  security: [
    {
      AdminTokenAuth: [],
    },
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        security: [],
        responses: {
          '200': {
            description: 'Service is healthy',
          },
        },
      },
    },
    '/api/dashboard/stats': {
      get: {
        summary: 'Get dashboard statistics',
        tags: ['Dashboard'],
        responses: {
          '200': {
            description: 'Summary metrics',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DashboardStats' },
              },
            },
          },
        },
      },
    },
    '/api/contacts': {
      get: {
        summary: 'List contacts',
        tags: ['Contacts'],
        responses: {
          '200': {
            description: 'Array of contacts',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Contact' },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create a new contact',
        tags: ['Contacts'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string' },
                  first_name: { type: 'string' },
                  last_name: { type: 'string' },
                  company: { type: 'string' },
                  role: { type: 'string' },
                  note: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Contact created',
          },
        },
      },
    },
    '/api/contacts/import': {
      post: {
        summary: 'Import contacts from CSV',
        tags: ['Contacts'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  csv: { type: 'string', description: 'Raw CSV text' },
                },
              },
            },
            'text/csv': {
              schema: {
                type: 'string',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Import summary',
          },
        },
      },
    },
    '/api/campaigns': {
      get: {
        summary: 'List campaigns',
        tags: ['Campaigns'],
        responses: {
          '200': {
            description: 'Array of campaigns',
          },
        },
      },
      post: {
        summary: 'Create a campaign',
        tags: ['Campaigns'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  daily_limit: { type: 'integer', default: 50 },
                  steps: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/CampaignStep' },
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Campaign created',
          },
        },
      },
    },
    '/api/campaigns/{id}': {
      get: {
        summary: 'Get campaign details',
        tags: ['Campaigns'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          '200': {
            description: 'Campaign details',
          },
        },
      },
      patch: {
        summary: 'Update campaign',
        tags: ['Campaigns'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  status: { type: 'string' },
                  daily_limit: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Campaign updated',
          },
        },
      },
    },
    '/api/campaigns/{id}/enroll': {
      post: {
        summary: 'Enroll contacts into campaign and queue sequence',
        tags: ['Campaigns'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  contact_ids: {
                    type: 'array',
                    items: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Contacts enrolled successfully',
          },
        },
      },
    },
    '/api/track/open/{emailId}': {
      get: {
        summary: 'Tracking pixel for email open detection',
        tags: ['Tracking'],
        security: [],
        parameters: [
          { name: 'emailId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          '200': {
            description: '1x1 transparent tracking GIF image',
            content: {
              'image/gif': {},
            },
          },
        },
      },
    },
    '/api/track/unsubscribe': {
      get: {
        summary: 'Signed unsubscribe link handler',
        tags: ['Tracking'],
        security: [],
        parameters: [
          { name: 'enrollment_id', in: 'query', required: true, schema: { type: 'integer' } },
          { name: 'email', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'sig', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Unsubscribe confirmed',
          },
        },
      },
    },
  },
};

export function setupSwagger(app: Express) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
}
