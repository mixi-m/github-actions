FROM python:3

ADD . /app
WORKDIR /app

RUN pip install -r requirements.txt
RUN ls -lh

CMD ["python", "release-pr.py"]
