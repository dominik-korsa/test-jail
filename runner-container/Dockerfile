FROM python:3

RUN apt-get update
RUN apt-get install gcc gcc-multilib g++ time -y --no-install-recommends

COPY ./runner.py /var/runner.py
