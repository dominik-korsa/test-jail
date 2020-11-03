import subprocess
import json
from time import time
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('command', action="extend", nargs="+")
parser.add_argument('-t, --timeout', required=True, type=float, dest="timeout")

args = parser.parse_args()

program_input = open('/tmp/input.txt', 'r')
start = time()
try:
  run_process = subprocess.Popen(args.command, stdout=subprocess.PIPE, stdin=program_input)
  stdout, stderr = run_process.communicate(timeout=args.timeout)
  end = time()
  if (run_process.returncode != 0):
    print(json.dumps({
      "type": "runtime-error",
      "message": "Process exited with error code {:d}".format(run_process.returncode)
    }))
  else:
    print(json.dumps({
      "type": "success",
      "output": stdout.decode("utf-8"),
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
