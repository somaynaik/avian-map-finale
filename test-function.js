import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');

let supabaseUrl = '';
let supabaseKey = '';

for (const line of envLines) {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
}

async function testFunction() {
  console.log("Triggering the Edge Function manually to check for errors...");
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/follow-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({})
    });
    
    const text = await response.text();
    console.log("Status Code:", response.status);
    console.log("Response Body:", text);
    
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}

testFunction();
