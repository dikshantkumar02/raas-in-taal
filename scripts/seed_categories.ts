import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seedCategories() {
  const categories = [
    {
      code: 'stag_girls',
      name: 'Stag Girls',
      price_paise: 24900,
      attendees_per_ticket: 1,
      description: 'Entry for 1 female attendee.',
      eligibility_rule: 'Strictly for female stags only.',
      display_order: 1,
      is_active: true,
    },
    {
      code: 'couple',
      name: 'Couple',
      price_paise: 44900,
      attendees_per_ticket: 2,
      description: 'Entry for 1 couple (2 attendees).',
      eligibility_rule: 'Valid for 1 couple (Male + Female).',
      display_order: 2,
      is_active: true,
    },
    {
      code: 'group',
      name: 'Group (4 People)',
      price_paise: 69900,
      attendees_per_ticket: 4,
      description: 'Entry for a squad of 4 people.',
      eligibility_rule: 'At least 1 female attendee is mandatory in the group.',
      display_order: 3,
      is_active: true,
    },
    {
      code: 'family',
      name: 'Family (4 Members)',
      price_paise: 69900,
      attendees_per_ticket: 4,
      description: 'Entry for 4 family members.',
      eligibility_rule: 'Valid for family members including kids/adults.',
      display_order: 4,
      is_active: true,
    },
  ];

  console.log('Seeding categories to Supabase...');
  const { data, error } = await adminClient.from('ticket_categories').upsert(categories, { onConflict: 'code' }).select();
  if (error) {
    console.error('Error seeding categories:', error);
  } else {
    console.log('Successfully seeded categories:', data);
  }
}

seedCategories();
