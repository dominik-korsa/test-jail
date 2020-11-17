**[test-jail](../README.md)**

> [Globals](undefined) / ["index"](../README.md) / Runner

# Class: Runner

Every runner instance manages a single container.
There can be only one code file at the same time in each container.
There can be multiple runners active simultaneously.

## Hierarchy

* **Runner**

## Index

### Constructors

* [constructor](_index_.runner.md#constructor)

### Properties

* [docker](_index_.runner.md#docker)
* [exitHandlers](_index_.runner.md#exithandlers)
* [extension](_index_.runner.md#extension)
* [imageName](_index_.runner.md#imagename)
* [instance](_index_.runner.md#instance)
* [resultsQueue](_index_.runner.md#resultsqueue)

### Methods

* [execCommand](_index_.runner.md#execcommand)
* [getOutput](_index_.runner.md#getoutput)
* [handleLine](_index_.runner.md#handleline)
* [isImagePulled](_index_.runner.md#isimagepulled)
* [isStarted](_index_.runner.md#isstarted)
* [onEnd](_index_.runner.md#onend)
* [ping](_index_.runner.md#ping)
* [pullImage](_index_.runner.md#pullimage)
* [removeImage](_index_.runner.md#removeimage)
* [run](_index_.runner.md#run)
* [sendCode](_index_.runner.md#sendcode)
* [sendInput](_index_.runner.md#sendinput)
* [start](_index_.runner.md#start)
* [stop](_index_.runner.md#stop)

## Constructors

### constructor

\+ **new Runner**(`dockerOptions?`: Docker.DockerOptions, `imageName?`: string): [Runner](_index_.runner.md)

*Defined in [src/index.ts:50](https://github.com/dominik-korsa/test-jail/blob/e012a68/src/index.ts#L50)*

Creates a Runner instance.

#### Parameters:

Name | Type | Default value | Description |
------ | ------ | ------ | ------ |
`dockerOptions?` | Docker.DockerOptions | - | Options passed to dockerode constructor. |
`imageName` | string | "dominikkorsa/runner:2.1.1" | Container image to use instead of the default one.  |

**Returns:** [Runner](_index_.runner.md)

## Properties

### docker

• `Readonly` **docker**: Docker

*Defined in [src/index.ts:40](https://github.com/dominik-korsa/test-jail/blob/e012a68/src/index.ts#L40)*

___

### exitHandlers

• `Private` **exitHandlers**: () => unknown[] = []

*Defined in [src/index.ts:111](https://github.com/dominik-korsa/test-jail/blob/e012a68/src/index.ts#L111)*

___

### extension

• `Private` `Optional` **extension**: [Extension](../README.md#extension)

*Defined in [src/index.ts:48](https://github.com/dominik-korsa/test-jail/blob/e012a68/src/index.ts#L48)*

___

### imageName

• `Private` `Readonly` **imageName**: string

*Defined in [src/index.ts:50](https://github.com/dominik-korsa/test-jail/blob/e012a68/src/index.ts#L50)*

___

### instance

• `Private` `Optional` **instance**: undefined \| { container: Docker.Container ; rl: readline.ReadLine ; stream: ReadWriteStream  }

*Defined in [src/index.ts:42](https://github.com/dominik-korsa/test-jail/blob/e012a68/src/index.ts#L42)*

___

### resultsQueue

• `Private` **resultsQueue**: (result: [Result](../README.md#result)) => unknown[] = []

*Defined in [src/index.ts:101](https://github.com/dominik-korsa/test-jail/blob/e012a68/src/index.ts#L101)*

## Methods

### execCommand

▸ `Private`**execCommand**(`cmd`: string[]): Promise\<void>

*Defined in [src/index.ts:225](https://github.com/dominik-korsa/test-jail/blob/e012a68/src/index.ts#L225)*

#### Parameters:

Name | Type |
------ | ------ |
`cmd` | string[] |

**Returns:** Promise\<void>

___

### getOutput

▸ **getOutput**(`outputContainerPath`: string): Promise\<Buffer>

*Defined in [src/index.ts:210](https://github.com/dominik-korsa/test-jail/blob/e012a68/src/index.ts#L210)*

Used to get back the output of a run.
The returned Buffer can be decoded to a string using `output.decode('utf-8')`

#### Parameters:

Name | Type | Description |
------ | ------ | ------ |
`outputContainerPath` | string | [ResultSuccess.outputContainerPath](../interfaces/_index_.resultsuccess.md#outputcontainerpath)  |

**Returns:** Promise\<Buffer>

___

### handleLine

▸ `Private`**handleLine**(`line`: string): Promise\<void>

*Defined in [src/index.ts:103](https://github.com/dominik-korsa/test-jail/blob/e012a68/src/index.ts#L103)*

#### Parameters:

Name | Type |
------ | ------ |
`line` | string |

**Returns:** Promise\<void>

___

### isImagePulled

▸ **isImagePulled**(): Promise\<boolean>

*Defined in [src/index.ts:269](https://github.com/dominik-korsa/test-jail/blob/e012a68/src/index.ts#L269)*

Checks if container image is pulled.

**Returns:** Promise\<boolean>

___

### isStarted

▸ **isStarted**(): boolean

*Defined in [src/index.ts:221](https://github.com/dominik-korsa/test-jail/blob/e012a68/src/index.ts#L221)*

Returns `true` if the container has been started and `false` otherwise

**Returns:** boolean

___

### onEnd

▸ `Private`**onEnd**(): Promise\<void>

*Defined in [src/index.ts:113](https://github.com/dominik-korsa/test-jail/blob/e012a68/src/index.ts#L113)*

**Returns:** Promise\<void>

___

### ping

▸ **ping**(): Promise\<boolean>

*Defined in [src/index.ts:244](https://github.com/dominik-korsa/test-jail/blob/e012a68/src/index.ts#L244)*

Attempts to connect to the Docker daemon.
Returns `true` if successful, `false` otherwise.

**Returns:** Promise\<boolean>

___

### pullImage

▸ **pullImage**(): Promise\<void>

*Defined in [src/index.ts:257](https://github.com/dominik-korsa/test-jail/blob/e012a68/src/index.ts#L257)*

Pulls the container image to the machine running Docker.
Returns when completed.

**Returns:** Promise\<void>

___

### removeImage

▸ **removeImage**(): Promise\<void>

*Defined in [src/index.ts:282](https://github.com/dominik-korsa/test-jail/blob/e012a68/src/index.ts#L282)*

Removes the container image from the machine running Docker.

**Returns:** Promise\<void>

___

### run

▸ **run**(`inputContainerPath`: string, `timeout`: number): Promise\<[Result](../README.md#result)>

*Defined in [src/index.ts:182](https://github.com/dominik-korsa/test-jail/blob/e012a68/src/index.ts#L182)*

Adds the input to the run queue, then tests the sent code against an input.

#### Parameters:

Name | Type | Description |
------ | ------ | ------ |
`inputContainerPath` | string | Path to input file on the container. Return value of [sendInput](_index_.runner.md#sendinput). |
`timeout` | number | Time in seconds after which the test will fail.  |

**Returns:** Promise\<[Result](../README.md#result)>

___

### sendCode

▸ **sendCode**(`data`: string \| Buffer, `extension`: string): Promise\<void>

*Defined in [src/index.ts:139](https://github.com/dominik-korsa/test-jail/blob/e012a68/src/index.ts#L139)*

Sends code to be used for testing.
There can only be one code file at the same time.

**`throws`** [UnknownExtensionError](../README.md#unknownextensionerror)

#### Parameters:

Name | Type | Description |
------ | ------ | ------ |
`data` | string \| Buffer | Content of the code to send. |
`extension` | string | Extension of the code file, for example: `.cpp`. Supported languages: [Extension](../README.md#extension). |

**Returns:** Promise\<void>

___

### sendInput

▸ **sendInput**(`data`: string \| Buffer): Promise\<string>

*Defined in [src/index.ts:161](https://github.com/dominik-korsa/test-jail/blob/e012a68/src/index.ts#L161)*

Sends input to the container
There can be multiple input files on the docker container

#### Parameters:

Name | Type | Description |
------ | ------ | ------ |
`data` | string \| Buffer | input to be sent |

**Returns:** Promise\<string>

Path to input file on the container.

___

### start

▸ **start**(): Promise\<void>

*Defined in [src/index.ts:66](https://github.com/dominik-korsa/test-jail/blob/e012a68/src/index.ts#L66)*

Starts the docker container.
Does nothing if already started.

**Returns:** Promise\<void>

___

### stop

▸ **stop**(): Promise\<void>

*Defined in [src/index.ts:124](https://github.com/dominik-korsa/test-jail/blob/e012a68/src/index.ts#L124)*

Stops the docker container.
Does nothing if not started.

**Returns:** Promise\<void>
