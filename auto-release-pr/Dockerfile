FROM python:3.10

ADD . /app
WORKDIR /app

RUN pip install -r requirements.txt

CMD ["python", "/app/release-pr.py"]
