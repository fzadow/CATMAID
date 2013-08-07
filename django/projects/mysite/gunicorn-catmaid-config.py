import multiprocessing
import os
import sys

# Add directory of file to path to be able to import settings
sys.path.insert(1, os.path.dirname(os.path.realpath(__file__)))

import settings

# Configure host and port for the WSGI server
host = getattr(settings, 'WSGI_HOST', '127.0.0.1')
port = getattr(settings, 'WSGI_PORT', 8080)

bind = "%s:%s" % (host, port)
worker_class="gevent"
# Rule of thumb for number of workers from:
# http://docs.gunicorn.org/en/latest/configure.html
workers = multiprocessing.cpu_count() * 2 + 1

def def_post_fork(server, worker):
    from psycogreen import gevent
    gevent.patch_psycopg()
    worker.log.info("Made Psycopg Green")

post_fork = def_post_fork

