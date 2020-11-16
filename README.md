# Test jail
Run C++ and Python programs against input files in a Docker container and save the output to files or compare against valid output.

![npm](https://img.shields.io/npm/v/test-jail?style=flat-square)
![Codecov](https://img.shields.io/codecov/c/github/dominik-korsa/test-jail?style=flat-square&token=QIRETKDW7L)
![Docker Image Size (latest semver)](https://img.shields.io/docker/image-size/dominikkorsa/runner?label=docker%20image%20size&style=flat-square)

*This package was previously called **Awesome test runner**.*\
*Versions up to **v.1.7.x** can be installed from https://www.npmjs.com/package/awesome-test-runner*

##### Requires Docker to be installed on your system
You can verify Docker installation using
```shell script
docker -v
```

## API Features
- Simple, promise based API
- Buffer support
- Runs code in a Docker container, preventing local file and process access 
- Uses Docker API (via dockerode)
- Integrated test queue
- Tested using Mocha
- Can run **C++** or **Python** programs (feel free to [create an issue](https://github.com/dominik-korsa/test-jail/issues/new) requesting a new language)

## CLI Features
- Run tests on a program and save output files
- Test a program using input/output files
- Print diff (jsdiff or line by line comparasion)
- Single and multiple input modes

## Usage
Install using:
```shell script
npm i test-jail -g
```
Usage help is available after installation:
```shell script
test-jail --help
```
