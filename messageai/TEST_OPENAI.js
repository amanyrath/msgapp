// Simple OpenAI API Test
// Run this with: node TEST_OPENAI.js

const OpenAI = require('openai');

// Test with direct API key input
async function testOpenAI() {
  console.log('Testing OpenAI API...');
  
  // Prompt for API key
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  readline.question('Enter your OpenAI API key: ', async (apiKey) => {
    if (!apiKey.trim()) {
      console.log('No API key provided');
      readline.close();
      return;
    }

    try {
      const openai = new OpenAI({ apiKey: apiKey.trim() });
      
      console.log('Making test request...');
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: 'Just say "Hello from OpenAI!" and nothing else.' }
        ],
        max_tokens: 10
      });

      console.log('✅ SUCCESS!');
      console.log('Response:', response.choices[0].message.content);
      console.log('Your API key works perfectly!');
      
    } catch (error) {
      console.log('❌ FAILED!');
      console.error('Error:', error.message);
    }
    
    readline.close();
  });
}

testOpenAI();
