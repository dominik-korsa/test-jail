FROM python:3

RUN apt-get update
RUN apt-get install gcc gcc-multilib g++ time -y --no-install-recommends

RUN mkdir /tmp/inputs
COPY ./runner.py /var/runner.py

CMD python -u "/var/runner.py"
