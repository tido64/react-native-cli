import fs from 'fs';
import path from 'path';
import {runCLI, getTempDirectory, cleanup, writeFiles} from '../jest/helpers';
import slash from 'slash';

const DIR = getTempDirectory('command-init');
const PROJECT_NAME = 'TestInit';

function createCustomTemplateFiles() {
  writeFiles(DIR, {
    'custom/template/template.config.js': `module.exports = {
      placeholderName: 'HelloWorld',
      templateDir: './template-dir',
    };`,
    'custom/template/package.json':
      '{ "name": "template", "version": "0.0.1" }',
    'custom/template/template-dir/package.json': '{}',
    'custom/template/template-dir/file': '',
    'custom/template/template-dir/dir/file': '',
  });
}

const customTemplateCopiedFiles = [
  '.git',
  'dir',
  'file',
  'package-lock.json',
  'package.json',
];

beforeEach(() => {
  cleanup(DIR);
  writeFiles(DIR, {});
});
afterEach(() => {
  cleanup(DIR);
});

let templatePath = path.resolve(DIR, 'custom', 'template');
if (process.platform === 'win32') {
  templatePath = slash(templatePath);
} else {
  templatePath = `file://${templatePath}`;
}

test('init fails if the directory already exists and --replace-directory false', () => {
  fs.mkdirSync(path.join(DIR, PROJECT_NAME));

  const {stderr} = runCLI(
    DIR,
    ['init', PROJECT_NAME, '--replace-directory', 'false'],
    {expectedFailure: true},
  );

  expect(stderr).toContain(
    `error Cannot initialize new project because directory "${PROJECT_NAME}" already exists.`,
  );
});

test('init should ask and print files in directory if exist', () => {
  fs.mkdirSync(path.join(DIR, PROJECT_NAME));
  fs.writeFileSync(path.join(DIR, PROJECT_NAME, 'package.json'), '{}');

  const {stdout, stderr} = runCLI(DIR, ['init', PROJECT_NAME]);

  expect(stdout).toContain(`Do you want to replace existing files?`);
  expect(stderr).toContain(
    `warn The directory ${PROJECT_NAME} contains files that will be overwritten:`,
  );
  expect(stderr).toContain(`package.json`);
});

test('init should prompt for the project name', () => {
  const {stdout} = runCLI(DIR, ['init']);

  expect(stdout).toContain('How would you like to name the app?');
});

test('init --template filepath', () => {
  createCustomTemplateFiles();

  const {stdout} = runCLI(DIR, [
    'init',
    '--template',
    templatePath,
    PROJECT_NAME,
    '--install-pods',
    'false',
  ]);

  expect(stdout).toContain('Run instructions');

  // make sure we don't leave garbage
  expect(fs.readdirSync(DIR)).toContain('custom');

  let dirFiles = fs.readdirSync(path.join(DIR, PROJECT_NAME));

  expect(dirFiles).toEqual(customTemplateCopiedFiles);
});

test('init --template file with custom directory', () => {
  createCustomTemplateFiles();
  const customPath = 'custom-path';

  const {stdout} = runCLI(DIR, [
    'init',
    '--template',
    templatePath,
    PROJECT_NAME,
    '--directory',
    'custom-path',
    '--install-pods',
    'false',
  ]);

  // make sure --directory option is used in run instructions
  expect(stdout).toContain(customPath);

  // make sure we don't leave garbage
  expect(fs.readdirSync(DIR)).toContain(customPath);

  let dirFiles = fs.readdirSync(path.join(DIR, customPath));
  expect(dirFiles).toEqual(customTemplateCopiedFiles);
});

test('init skips installation of dependencies with --skip-install', () => {
  createCustomTemplateFiles();

  const {stdout} = runCLI(DIR, [
    'init',
    '--template',
    templatePath,
    PROJECT_NAME,
    '--skip-install',
  ]);

  expect(stdout).toContain('Run instructions');

  if (process.platform === 'darwin') {
    expect(stdout).toContain('Install Cocoapods');
  }

  // make sure we don't leave garbage
  expect(fs.readdirSync(DIR)).toContain('custom');

  let dirFiles = fs.readdirSync(path.join(DIR, PROJECT_NAME));

  expect(dirFiles).toEqual(
    customTemplateCopiedFiles.filter(
      (file) => !['node_modules', 'package-lock.json'].includes(file),
    ),
  );
});

// react-native-macos stopped shipping `template.config.js` for 0.75, so this test is disabled. in future releases we should re-enable once `template.config.js` will be there again.
test.skip('init --platform-name should work for out of tree platform', () => {
  createCustomTemplateFiles();
  const outOfTreePlatformName = 'react-native-macos';

  const {stdout} = runCLI(DIR, [
    'init',
    PROJECT_NAME,
    '--platform-name',
    outOfTreePlatformName,
    '--skip-install',
    '--verbose',
  ]);

  expect(stdout).toContain('Run instructions');
  // This will no longer contain react-native-macos@latest, but
  // react-native-macos@0.74.1 or whatever the concrete version
  // matching @latest at the time of execution.
  expect(stdout).toContain(
    `Installing template from ${outOfTreePlatformName}@`,
  );

  // make sure we don't leave garbage
  expect(fs.readdirSync(DIR)).toContain('custom');

  let dirFiles = fs.readdirSync(path.join(DIR, PROJECT_NAME));

  expect(dirFiles.length).toBeGreaterThan(0);
});
