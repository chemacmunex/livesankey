import ast
import copy
import json
import os.path
from datetime import datetime
from datetime import timedelta

import cherrypy
import requests

import sankey
import secret


class WebServer(object):

    @cherrypy.expose
    def index(self):
        global sankey_obj
        if not sankey_obj:
            sankey_obj = sankey.Sankey(secret.data_model_json_file_path)
        return open('html/sankey.html', encoding='utf-8')

    @cherrypy.expose
    def navbar(self):
        return open('html/navbar.html', encoding='utf-8')

    @cherrypy.expose
    def data_model(self):
        return open(secret.data_model_json_file_path, encoding='utf-8')


@cherrypy.expose
class SankeyAPI(object):
    @cherrypy.tools.accept(media='text/plain')
    def POST(self, cols_str_arr, nodesClicked_str_arr, dni_limit_str):
        input_table_col_sorted_list = ast.literal_eval(cols_str_arr)
        input_filtered_node_list = ast.literal_eval(nodesClicked_str_arr)
        dni_limit = int(float(dni_limit_str))

        global sankey_obj
        nodes_json, links_json = sankey_obj.get_data(input_table_col_sorted_list, input_filtered_node_list, dni_limit)

        return '{"nodes":' + nodes_json, ',"links":' + links_json + '}'


if __name__ == '__main__':
    sankey_obj = None

    server_conf = {
        'server.socket_host': '0.0.0.0',
        'server.socket_port': 443,
        'server.ssl_certificate': 'cert/cert.pem',
        'server.ssl_private_key': 'cert/privkey.pem',
        'environment': 'production',
        'log.access_file': 'log/access.log',
        'log.error_file': 'log/error.log'
    }
    app_conf = {
        '/': {
            'tools.sessions.on': True,
            'tools.sessions.timeout': 60,
            'tools.staticdir.root': os.path.abspath(os.getcwd()),
        },
        '/sankey': {
            'request.dispatch': cherrypy.dispatch.MethodDispatcher(),
            'tools.response_headers.on': True,
            'tools.response_headers.headers': [('Content-Type', 'text/plain')],
        },
        '/static': {
            'tools.staticdir.on': True,
            'tools.staticdir.dir': 'public'
        }
    }

    cherrypy.config.update(server_conf)

    webapp = WebServer()
    webapp.sankey = SankeyAPI()
    cherrypy.quickstart(webapp, '/', app_conf)
