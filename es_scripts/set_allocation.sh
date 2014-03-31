curl -XPUT localhost:9200/_cluster/settings -d '{
    "persistent" : {
        "cluster.routing.allocation.disk.threshold_enabled" : true,
	"cluster.routing.allocation.disk.watermark.low": 0.95,
	"cluster.routing.allocation.disk.watermark.high": 0.99
    }
}'
