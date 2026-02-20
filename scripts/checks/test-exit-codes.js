/**
 * Test exit codes for all check scripts
 */
const { spawn } = require('child_process');
const path = require('path');

const scripts = [
  'check-tables.js',
  'check-win-rules-table.js',
  'check-rooms.js',
  'check-game-columns.js',
];

let passed = 0;
let failed = 0;

function runScript(scriptName) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, scriptName);
    const child = spawn('node', [scriptPath], {
      env: { ...process.env },
      stdio: 'pipe'
    });

    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      output += data.toString();
    });

    child.on('close', (code) => {
      resolve({ scriptName, exitCode: code, output });
    });
  });
}

async function testScripts() {
  console.log('🧪 Testing Exit Codes for Check Scripts\n');
  console.log('═'.repeat(60));

  for (const script of scripts) {
    console.log(`\nTesting: ${script}`);
    console.log('-'.repeat(60));

    const result = await runScript(script);

    if (result.exitCode === 0) {
      console.log(`✅ PASS - Exit code: ${result.exitCode}`);
      passed++;
    } else {
      console.log(`❌ FAIL - Exit code: ${result.exitCode}`);
      console.log('Output:', result.output.substring(0, 200));
      failed++;
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log('\n⚠️  Some scripts failed. This might be expected if:');
    console.log('   - Database is not accessible');
    console.log('   - Tables are missing');
    console.log('   - Environment variables are not set');
    console.log('\n💡 Run individual scripts to see detailed error messages.');
  } else {
    console.log('\n✅ All scripts executed successfully!');
  }

  process.exit(failed > 0 ? 1 : 0);
}

testScripts().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
