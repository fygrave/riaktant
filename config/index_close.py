#!/usr/bin/env python

import sys
import os
import datetime
import time
from datetime import timedelta
#from dateutil import parser
#import redis
import json
os.environ["DJANGO_SETTINGS_MODULE"] =  "settings"# pyes + django bug(?)
from pyes import *
import sys
print sys.argv[1]
conn = ES([sys.argv[1]])
def getindex():
    index_name = 'searchindex-%.4i%.2i%.2i%.2i'% (datetime.datetime.now().year, datetime.datetime.now().month, datetime.datetime.now().day, datetime.datetime.now().hour)
    return index_name

def daterange(start_date, end_date):
    for n in range(int ((end_date - start_date).days)):
        yield start_date + timedelta(n)

#for single_date in daterange(start_date, end_date):
#    print strftime("%Y-%m-%d", single_date.timetuple())

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

start=datetime.datetime.now() - timedelta(30 )
#end = datetime.datetime.now() - timedelta(1)
end = datetime.datetime.now() 
for f in daterange(start, end):
	for h in range(0, 24):
		d2 = datetime.datetime(f.year, f.month, f.day, h, 00, 00)
		print getdateindex(d2)
		try:
			conn.delete_alias("searchindex", indices = [getdateindex(d2)])
			conn.close_index(getdateindex(d2))
		except Exception, e:
			print e


#number_of_nodes = len(conn.cluster_nodes()["nodes"])
#conn.add_alias("searchindex", indices=[ getindex()])
#conn.add_alias("today", indices=[ getindex()])
#conn.add_alias(getindexaliasday(), indices=[ getindex()])
#conn.add_alias(getindexaliasmonth(), indices=[ getindex()])
#conn.delete_alias("today", indices = [getdateindex(datetime.datetime.now() - datetime.timedelta(1))])
#conn.optimize(indices=[getdateindex(datetime.datetime.now() - datetime.timedelta(0,0,0,0,0,2))])
#conn.index({"originalMessage": "test"}, "searchindex-2233", "searchindex-type")

#conn.put_mapping("malwr-type", {'properties':mapping}, [getindex()])
#conn.put_mapping(doc_type="searchindex-type", mapping = mapping, indices=[getindex()])
