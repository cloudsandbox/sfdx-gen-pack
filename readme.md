# Overview

CLI Tool to generate Salesforce.com package.xml (and destructiveChange.xml) files based on git diff between two branches. 

## Install

```
git clone https://github.com/cloudsandbox/sfdx-gen-pack.git && cd sfdx-gen-pack && npm link
```

## Usage

```
$ sfdxgp destinationBranch sourceBranch ./manifest/
```

This will create a package at ./manifest/package.xml and copy all the files into ./manifest/sourceBranch/unpackaged/ directory.

If any deletes occurred will also create ./manifest/destructiveChanges.xml

You can force a specific version for the package.xml with the -p flag

```
sfdxgp destinationBranch sourceBranch -p 42 ./deploy/
```

You can also just write the package.xml and destructiveChanges.xml by passing the -d flag

```
sfdxgp destinationBranch sourceBranch -d > ~/Desktop/packageAndDestructiveChanges.xml
```

You can also create "backout" content by reversing the order of the destination and source branches

```
sfdxgp sourceBranch destinationBranch ./deploy/
```


