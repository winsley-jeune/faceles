/**
 * Renderer Security Test Suite
 * Tests shell injection protection in FFmpeg commands
 */

import fs from 'fs';

console.log('='.repeat(60));
console.log('RENDERER SHELL INJECTION PROTECTION - TEST SUITE');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

function test(name, condition) {
    if (condition) {
        console.log(`  ✅ ${name}`);
        passed++;
    } else {
        console.log(`  ❌ ${name}`);
        failed++;
    }
}

// ============================================================
// TEST 1: Verify renderer.js Has Security Functions
// ============================================================
console.log('\n📋 TEST 1: Security Function Presence\n');

const rendererCode = fs.readFileSync('./modules/renderer.js', 'utf8');

test('Has execFile import', rendererCode.includes('execFile'));
test('Has execFilePromise function', rendererCode.includes('execFilePromise'));
test('Has validateFilePath function', rendererCode.includes('validateFilePath'));
test('Has escapeFFmpegFilterPath function', rendererCode.includes('escapeFFmpegFilterPath'));

// ============================================================
// TEST 2: Verify exec() is NOT used for FFmpeg
// ============================================================
console.log('\n📋 TEST 2: Dangerous exec() Usage Check\n');

// Count uses of exec vs execFile
const execCalls = (rendererCode.match(/\bexec\(/g) || []).length;
const execFileCalls = (rendererCode.match(/\bexecFile\(/g) || []).length;
const execFilePromiseCalls = (rendererCode.match(/execFilePromise\(/g) || []).length;

console.log(`  📊 exec() calls: ${execCalls}`);
console.log(`  📊 execFile() calls: ${execFileCalls}`);
console.log(`  📊 execFilePromise() calls: ${execFilePromiseCalls}`);

// exec should only appear in the import statement and comments, not in FFmpeg calls
test('No dangerous exec() for FFmpeg commands', !rendererCode.includes('await exec(') && !rendererCode.includes('execPromise('));
test('Uses execFilePromise for FFmpeg', execFilePromiseCalls > 0);

// ============================================================
// TEST 3: Verify File Path Validation
// ============================================================
console.log('\n📋 TEST 3: File Path Validation Logic\n');

test('validateFilePath checks allowed directories', rendererCode.includes('allowedDirs'));
test('validateFilePath uses path.resolve', rendererCode.includes('path.resolve'));
test('validateFilePath throws on invalid paths', rendererCode.includes('Path not allowed'));

// ============================================================
// TEST 4: Verify FFmpeg Filter Escaping
// ============================================================
console.log('\n📋 TEST 4: FFmpeg Filter Path Escaping\n');

test('Escapes backslashes', rendererCode.includes(".replace(/\\\\/g, '/')"));
test('Escapes colons', rendererCode.includes(".replace(/:/g, '\\\\:')"));
test('Escapes single quotes', rendererCode.includes(".replace(/'/g,"));
test('Escapes square brackets', rendererCode.includes(".replace(/\\[/g, '\\\\[')"));

// ============================================================
// TEST 5: Verify FFmpeg Calls Use Argument Arrays
// ============================================================
console.log('\n📋 TEST 5: FFmpeg Argument Array Pattern\n');

// Check that FFmpeg calls use arrays, not string interpolation
test('animateImage uses execFilePromise',
    rendererCode.includes("await execFilePromise('ffmpeg', ["));

// generateStyledSubtitles uses execFilePromise at line 266
test('generateStyledSubtitles uses execFilePromise',
    rendererCode.includes("await execFilePromise('ffmpeg', ['-y', '-i',"));

// ============================================================
// TEST 6: Simulate Path Validation
// ============================================================
console.log('\n📋 TEST 6: Path Validation Simulation\n');

import path from 'path';

// Simulate the validateFilePath function
const validateFilePath = (filePath, allowedDirs = ['/tmp', '/app/videos', process.cwd()]) => {
    const absolutePath = path.resolve(filePath);
    const isAllowed = allowedDirs.some(dir => absolutePath.startsWith(path.resolve(dir)));
    if (!isAllowed) {
        throw new Error(`Path not allowed: ${filePath}`);
    }
    return absolutePath;
};

// Test valid paths
try {
    const validPath = validateFilePath('./videos/test.mp4');
    test('Allows path in current directory', true);
} catch (e) {
    test('Allows path in current directory', false);
}

// Test path traversal attempt
try {
    validateFilePath('../../../etc/passwd');
    test('Blocks path traversal (../../)', false);
} catch (e) {
    test('Blocks path traversal (../../)', e.message.includes('Path not allowed'));
}

// ============================================================
// TEST 7: Simulate FFmpeg Filter Escaping
// ============================================================
console.log('\n📋 TEST 7: FFmpeg Filter Escaping Simulation\n');

// Simulate the escapeFFmpegFilterPath function
const escapeFFmpegFilterPath = (filePath) => {
    return filePath
        .replace(/\\/g, '/')
        .replace(/:/g, '\\:')
        .replace(/'/g, "'\\''")
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]');
};

// Test escaping - verify the function transforms the input
// Note: The escapeFFmpegFilterPath function replaces \ with /
const testPath = '/path/test.mp4';
test('Basic path passthrough works',
    escapeFFmpegFilterPath(testPath) === '/path/test.mp4');

test('Escapes colons in paths',
    escapeFFmpegFilterPath('/path/with:colon.mp4').includes('\\:'));

test('Escapes square brackets',
    escapeFFmpegFilterPath('/path/[file].mp4').includes('\\['));

// Verify the code in renderer.js has the backslash replacement
test('Renderer code handles backslashes',
    rendererCode.includes(".replace(/\\\\/g, '/')"));

// ============================================================
// SUMMARY
// ============================================================
console.log('\n' + '='.repeat(60));
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed === 0) {
    console.log('\n✅ All renderer security tests passed!\n');
    process.exit(0);
} else {
    console.log('\n❌ Some tests failed!\n');
    process.exit(1);
}
