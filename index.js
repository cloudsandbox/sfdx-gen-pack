#!/usr/bin/env node

/**
 * CLI tool to parse git diff and build a package.xml file from it.
 * Useful for larger orgs to avoid deploying all metadata in automated deployments in a SFDX style project
 *
 * usage:
 *  $ sfdxgp master featureBranch ./manifest/
 *
 */

var program = require('commander');
var util = require('util'),
    spawnSync = require('child_process').spawnSync,
    packageWriter = require('./lib/metaUtils').packageWriter,
    buildPackageDir = require('./lib/metaUtils').buildPackageDir,
    copyFiles = require('./lib/metaUtils').copyFiles,
    packageVersion = require('./package.json').version;


program
    .arguments('<compare> <branch> [target]')
    .version(packageVersion)
    .option('-d, --dryrun', 'Only print the package.xml and destructiveChanges.xml that would be generated')
    .option('-p, --pversion [version]', 'Salesforce version of the package.xml', parseInt)
    .action(function (compare, branch, target) {

        if (!branch || !compare) {
            console.error('branch and target branch are both required');
            program.help();
            process.exit(1);
        }

        var dryrun = false;
        if (program.dryrun) {
            dryrun = true;
        }

        if (!dryrun && !target) {
            console.error('target required when not dry-run');
            program.help();
            process.exit(1);
        }

        var currentDir = process.cwd();
        const gitDiff = spawnSync('git', ['--no-pager', 'diff', '--name-status', compare, branch]);
        var gitDiffStdOut = gitDiff.stdout.toString('utf8');
        var gitDiffStdErr = gitDiff.stderr.toString('utf8');

        if (gitDiffStdErr) {
            console.error('An error has occurred: %s', gitDiffStdErr);
            process.exit(1);
        }

        var fileListForCopy = [],
            fileList = [];

        //defines the different member types
        var metaBag = {};
        var metaBagDestructive = {};
        var deletesHaveOccurred = false;

        fileList = gitDiffStdOut.split('\n');
        fileList.forEach(function (fileName, index) {

            // get the git operation
            var operation = fileName.slice(0,1);
            // remove the operation and spaces from fileName
            fileName = fileName.slice(1).trim();

            //ensure file is inside of src directory of project
            //console.log('here');
            //console.log(fileName);
            if (fileName && fileName.substring(0,23) === 'force-app/main/default/') {

                //ignore changes to the package.xml file
                if(fileName === 'src/package.xml') {
                    return;
                }

                fileName = fileName.replace('force-app/main/default/','src/');

                var parts = fileName.split('/');
                // Check for invalid fileName, likely due to data stream exceeding buffer size resulting in incomplete string
                // TODO: need a way to ensure that full fileNames are processed - increase buffer size??
                //console.log('full file split');
                //console.log(parts);

                

                if (parts[2] === undefined) {
                    console.error('File name "%s" cannot be processed, exiting', fileName);
                    process.exit(1);
                }

                var meta;

                //console.log('part 4');
                //console.log(parts[4]);
                
                if (parts.length === 4) {
                    // Processing metadata with nested folders e.g. emails, documents, reports
                    meta = parts[2] + '/' + parts[3].split('.')[0];
                } else {
                    // Processing metadata without nested folders. Strip -meta from the end.
                    meta = parts[2].split('.')[0].replace('-meta', '');
                }

                if (operation === 'A' || operation === 'M') {
                    // file was added or modified - add fileName to array for unpackaged and to be copied
                    console.log('File was added or modified: %s', fileName);
                    fileName = fileName.replace('src/','force-app/main/default/');
                    fileListForCopy.push(fileName);
                    //console.log('*******');
                    //console.log(parts[1]);

                    //console.log('*******');
                    //console.log(metaBag);

                    if (!metaBag.hasOwnProperty(parts[1])) {
                        metaBag[parts[1]] = [];
                    }

                    if (metaBag[parts[1]].indexOf(meta) === -1) {
                        metaBag[parts[1]].push(meta);
                    }
                    //console.log(metaBag);

                } else if (operation === 'D') {
                    // file was deleted
                    console.log('File was deleted: %s', fileName);
                    deletesHaveOccurred = true;

                    if (!metaBagDestructive.hasOwnProperty(parts[1])) {
                        metaBagDestructive[parts[1]] = [];
                    }

                    if (metaBagDestructive[parts[1]].indexOf(meta) === -1) {
                        metaBagDestructive[parts[1]].push(meta);
                    }
                } else {
                    // situation that requires review
                    return console.error('Operation on file needs review: %s', fileName);
                }
            }
        });

        //build package file content
        var packageXML = packageWriter(metaBag, program.pversion);
        //build destructiveChanges file content
        var destructiveXML = packageWriter(metaBagDestructive, program.pversion);
        if (dryrun) {
            console.log('\npackage.xml\n');
            console.log(packageXML);
            console.log('\ndestructiveChanges.xml\n');
            console.log(destructiveXML);
            process.exit(0);
        }

        console.log('Building in directory %s', target);

        buildPackageDir(target, branch, metaBag, packageXML, false, (err, buildDir) => {

            if (err) {
                return console.error(err);
            }

            copyFiles(currentDir, buildDir, fileListForCopy);
            console.log('Successfully created package.xml and files in %s',buildDir);

        });

        if (deletesHaveOccurred) {
            buildPackageDir(target, branch, metaBagDestructive, destructiveXML, true, (err, buildDir) => {

                if (err) {
                    return console.error(err);
                }

                console.log('Successfully created destructiveChanges.xml in %s',buildDir);
            });
        }
    });

program.parse(process.argv);
