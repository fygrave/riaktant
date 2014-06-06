#!/usr/bin/env python

import sys
import os
import datetime
import time
#from dateutil import parser
#import redis
import json
os.environ["DJANGO_SETTINGS_MODULE"] =  "settings"# pyes + django bug(?)
from pyes import *
import sys
print sys.argv[1]
conn = ES([sys.argv[1]])

data = conn._send_request('GET', '/_cluster/state')

if data["master_node"] != os.uname()[1]:
    print "not a master"
    sys.exit(1)

def getindex():
    index_name = 'searchindex-%.4i%.2i%.2i%.2i'% (datetime.datetime.now().year, datetime.datetime.now().month, datetime.datetime.now().day, datetime.datetime.now().hour)
    return index_name
def getindexaliasday():
    index_name = 'searchindex-%.4i%.2i%.2i'% (datetime.datetime.now().year, datetime.datetime.now().month, datetime.datetime.now().day)
    return index_name
def getindexaliasmonth():
    index_name = 'searchindex-%.4i%.2i'% (datetime.datetime.now().year, datetime.datetime.now().month)
    return index_name
def getdateindex(date):
    index_name = 'searchindex-%.4i%.2i%.2i%.2i'% (date.year, date.month, date.day, date.hour)
    return index_name
#reclient = redis.Redis(host='localhost', port=6833)
number_of_nodes = len(conn.cluster_nodes()["nodes"])
conn.add_alias("searchindex", indices=[ getindex()])
conn.add_alias("today", indices=[ getindex()])
conn.add_alias(getindexaliasday(), indices=[ getindex()])
conn.add_alias(getindexaliasmonth(), indices=[ getindex()])
conn.delete_alias("today", indices = [getdateindex(datetime.datetime.now() - datetime.timedelta(1))])
#conn.optimize(indices=[getdateindex(datetime.datetime.now() - datetime.timedelta(0,0,0,0,0,2))])
#conn.index({"originalMessage": "test"}, "searchindex-2233", "searchindex-type")

#conn.put_mapping("malwr-type", {'properties':mapping}, [getindex()])
#conn.put_mapping(doc_type="searchindex-type", mapping = mapping, indices=[getindex()])
