import subprocess
import json
from time import time
import argparse
from random import uniform
from math import floor
import os

parser = argparse.ArgumentParser()
parser.add_argument('command', action="extend", nargs="+")
parser.add_argument('-t, --timeout', required=True, type=float, dest="timeout")

args = parser.parse_args()

output_directory = "/tmp/outputs"
if not os.path.exists(output_directory):
    os.makedirs(output_directory)
program_output_path = os.path.join(output_directory, str(floor(time())) + "-" + str(uniform(10000, 99999)) + ".out")
program_input = open('/tmp/input.in', 'r')
program_output = open(program_output_path, 'w')

start = time()
try:
  run_process = subprocess.Popen(args.command, stdout=program_output, stdin=program_input)
  run_process.wait(timeout=args.timeout)
  end = time()
  if (run_process.returncode != 0):
    print(json.dumps({
      "type": "runtime-error",
      "message": "Process exited with error code {:d}".format(run_process.returncode)
    }))
  else:
    print(json.dumps({
      "type": "success",
      "outputContainerPath": program_output_path,
      "time": end - start,
    }))
except subprocess.TimeoutExpired:
  print(json.dumps({
    "type": 'timeout'
  }))
except Exception as error:
  print(json.dumps({
    "type": "runtime-error",
    "message": str(error)
  }))
