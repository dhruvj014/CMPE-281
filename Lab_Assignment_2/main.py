from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def home():
    # Your personal information
    student_info = {
        'name': 'Dhruv Jain',
        'sjsu_id': '019150859',
        'email': 'dhruvsachin.jain@sjsu.edu',
        'semester': 'Fall 2025',
        'program': 'MS Software Engineering',
        'course': 'CMPE 281 - Cloud Technologies',
        'assignment': 'Lab #2: Google App Engine Deployment'
    }
    return render_template('index.html', info=student_info)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
