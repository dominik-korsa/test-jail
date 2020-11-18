![Test jail logo](https://github.com/dominik-korsa/test-jail/raw/master/.github/images/header.png)

# Test jail
![npm](https://img.shields.io/npm/v/test-jail?style=flat-square)
![Codecov](https://img.shields.io/codecov/c/github/dominik-korsa/test-jail?style=flat-square&token=QIRETKDW7L)
![Docker Image Size (latest semver)](https://img.shields.io/docker/image-size/dominikkorsa/runner?label=docker%20image%20size&style=flat-square)

Run C++ and Python programs against input files in a Docker container and save the output to files or compare against valid output.

##### [Read the latest API documentation here](https://dominik-korsa.github.io/test-jail)

*This package was previously called **Awesome test runner**.*\
*Versions up to **v.1.7.x** can be installed from https://www.npmjs.com/package/awesome-test-runner*

##### Requires Docker to be installed on your system

## API Features
- Simple, promise based API
- Buffer support
- Runs code in a Docker container, preventing local file and process access
- Uses Docker API (via dockerode)
- Integrated test queue
- Tested using Mocha
- Can run **C++** or **Python** programs (feel free to [create an issue](https://github.com/dominik-korsa/test-jail/issues/new) requesting a new language)
- Written fully in TypeScript
- [Documented](https://dominik-korsa.github.io/test-jail) using JSDoc and TypeDoc

## CLI Features
- Run tests on a program and save output files
- Test a program using input/output files
- Print diff (jsdiff or line by line comparison)
- Single and multiple input modes

## CLI Example usage
Install globally using:
```shell script
npm i test-jail -g
```
Usage help is available after installation:
```shell script
test-jail --help
```
To test if the Docker daemon is running and accessible run:
```shell script
test-jail ping
```
The program can then run in two modes:
##### Run
This mode compiles and runs a program, then passess the specified input files to its standard input.
If there was no error, standard output is saved on your file system.
Example usage:
```shell script
test-jail run code.py -i input -o output
```
Input and output can either be a single file or a directory. All the paths are relative to your current working directory.
The input files should have an `.in` extension. The output files will have the same name, but with an `.out` extension.
##### Test
The test mode works similar to the run mode, but instead of saving the standard output to files, it's compared to the files that already exist (they can be generated using the run command on diffirent code, or just written manually), and the difference is shown.
```shell script
test-jail test code.py -i input -o output
```
