#!/usr/bin/env python
import urllib
import json
from pyes import *
import sys
import time
from sets import Set
import random
import datetime
import os

nodes = Set()
c = ES([sys.argv[1]])
#nodes.add('bacMfr_nSUCtDQCnWokAdQ')
data = c._send_request('GET', '/_cluster/state')
# populate nodes array first

if data["master_node"] != os.uname()[1]:
    print "not a master"
    sys.exit(1)

for ind in data['routing_table']['indices']:
    #if not data['blocks']['indices'][ind].has_key('shards'):
    #    continue
    print "%s" % ind
    for shard in data['routing_table']['indices'][ind]['shards']:
        shd = data['routing_table']['indices'][ind]['shards'][shard]
        for sh in shd:
            print sh['node']
            print sh
            if sh['node'] != None:
                #print sh['node']
                nodes.add(sh['node'])

# do actual fixage :)
def getindex():
    index_name = 'searchindex-%.4i%.2i%.2i%.2i'% (datetime.datetime.now().year, datetime.datetime.now().month, datetime.datetime.now().day, datetime.datetime.now().hour)
    return index_name



for ind in data['routing_table']['indices']:
    #if not data['blocks']['indices'][ind].has_key('shards'):
    #    continue
    print "%s" % ind
    for shard in data['routing_table']['indices'][ind]['shards']:
        shd = data['routing_table']['indices'][ind]['shards'][shard]
        for sh in shd:
            print sh['node']
            print sh
            if sh['node'] != None:
                #print sh['node']
                nodes.add(sh['node'])
            else:
                print "missing shard index %s shard %s" % (ind, shard)
                done = False
                while not done:
                    newnode = random.sample(nodes, 1)
                    print "new node %s" % (newnode[0])
                    # curl -XPOST http://localhost:9200/_cluster/reroute -d
                    nind = getindex()
                    if ind == nind:
                        body = {"commands":[{"allocate":{"index": ind,"shard":int(shard),"node":newnode[0],"allow_primary": True}}]}
                        try:
                            c._send_request('POST', '/_cluster/reroute', body=body)
                            done = True
                            time.sleep(20)
                        except Exception, e:
                            print e
                            done = False
                    else:
                        done = True
                    

 
print nodes
