from flask import Flask
import redis

app = Flask(__name__)
# Підключення до сервісу 'redis' за його мережевим іменем
db = redis.Redis(host='redis', port=6379)

@app.route('/')
def hello():
    try:
        visits = db.incr('counter')
    except redis.exceptions.ConnectionError:
        visits = "не вдалося підключитися до Redis"
    
    return f"<h1>Лабораторна робота №11</h1><p>Кількість відвідувань сайту: <b>{visits}</b></p>\n"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)