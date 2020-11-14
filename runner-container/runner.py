#!/usr/bin/env python
import subprocess
import shlex
import json
from time import time, sleep
from random import uniform
from math import floor
import os
import sys
import base64

def b64encode(data):
  return base64.b64encode(data.encode('utf-8')).decode('utf-8')

def b64decode(encoded):
  return base64.b64decode(encoded.encode('utf-8')).decode('utf-8')

for line in sys.stdin:
  try:
    request = json.loads(b64decode(line.strip()))
    output_directory = "/tmp/outputs"
    if not os.path.exists(output_directory):
      os.makedirs(output_directory)
    program_output_path = os.path.join(output_directory, str(floor(time())) + "-" + str(uniform(10000, 99999)) + ".out")
    program_input = open(request["input"], 'r')
    program_output = open(program_output_path, 'w')

    start = time()
    run_process = subprocess.Popen(
      shlex.split(request["command"]),
      stdout=program_output,
      stderr=subprocess.PIPE,
      stdin=program_input,
    )
    _, err = run_process.communicate(timeout=request["timeout"])
    end = time()
    if (run_process.returncode != 0):
      print(b64encode(json.dumps({
        "type": "runtime-error",
        "message": "Process exited with error code {:d}".format(run_process.returncode),
        "stderr": err.decode("utf-8"),
      })))
    else:
      print(b64encode(json.dumps({
        "type": "success",
        "outputContainerPath": program_output_path,
        "time": end - start,
      })))
  except subprocess.TimeoutExpired:
    print(b64encode(json.dumps({
      "type": 'timeout'
    })))
  except Exception as error:
    print(b64encode(json.dumps({
      "type": "runtime-error",
      "message": str(error)
    })))
