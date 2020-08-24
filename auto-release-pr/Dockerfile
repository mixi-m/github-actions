FROM python:3

ADD . /app
WORKDIR /app

RUN pip install -r requirements.txt

CMD ["python", "release-pr.py"]
