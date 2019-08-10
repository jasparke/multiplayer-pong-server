#!flask/bin/python
import sys
import datetime
import os
import dmmRedis

from flask import Flask, jsonify, make_response, request, abort, render_template, g

app = Flask(__name__)
users = []
R = dmmRedis.DMM('settings.ini')

@app.route('/games', methods=['PUT'])
def update():
    ip = request.remote_addr
    if not request.get_json():
        print("no request.json")
        abort(400)
    if not 'user' in request.json:
        print("user not provided")
        abort(400)
    else:
        user = request.json.get('user')
        R.gateway(ip, user)
        return jsonify(user), 200 

    abort(404)