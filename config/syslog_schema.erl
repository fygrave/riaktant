{schema,
  [
   {version, "0.1"},
   {default_field, "message"},
   {default_op, "or"},
   {n_val, 3},
   {analyzer_factory, {erlang, text_analyzers, noop_analyzer_factory}}
  ],
  [
   {field, [{name, "id"},
            {required, true}]},
   {field, [{name, "originalMessage"},
            {required, true},
            {skip, true}]},
   {field, [{name, "facility"}, {analyzer_factory, {erlang, text_analyzers, noop_analyzer_factory}} ]},
   {field, [{name, "version"}]},
   {field, [{name, "host"},
              {analyzer_factory, {erlang, text_analyzers, noop_analyzer_factory}} ]},
   {field, [{name, "origin"}, {inline, true},
              {analyzer_factory, {erlang, text_analyzers, noop_analyzer_factory}} ]},
   {field, [{name, "src"}]},
   {field, [{name, "dst"}]},
   {field, [{name, "class"}]},
   {field, [{name, "sensor"}]},
   {field, [{name, "date"},
	   {type, integer}, {inline, true},
                       {analyzer_factory, {erlang, text_analyzers, integer_analyzer_factory}} ]},
   {field, [{name, "severity"},
	   {type, integer}, {inline, true},
                       {analyzer_factory, {erlang, text_analyzers, integer_analyzer_factory}} ]},
   {field, [{name, "time"},
            {type, date}]},
   {field, [{name, "message"}, {inline, true},
            {analyzer_factory, {erlang, text_analyzers, standard_analyzer_factory}}]},
   % Skip anything we don't care about
   {dynamic_field, [{name, "*"},
                    {skip, true}]}
  ]
 }.
