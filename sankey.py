import json

import secret
from PostgresConnection import PostgresConnection

MONOVALUED = 'monovalued'
MULTIVALUED = 'multivalued'

TABLENAME = 'tablename'
KEY_COLNAME = 'key_colname'
VALUES_COLNAME = 'values_colname'

COLNAME = 'colname'
DISPLAY_NAME = 'display_name'

SORBY_COLNAME = 'sortby_colname'
LOOKUP_TABLENAME = 'display_positions_tablename'

LUP_VALUE = 'field_value'
LUP_POSITION = 'field_position'


class Sankey:
    def __init__(self, dm_json_file_path):
        # data_model_dic
        # tablename: {
        #   "key_colname": "",
        #   "values_colname": [
        #         {
        #             "colname": "",
        #             "display_name": ""
        #         }, ...
        #     ],
        #   "sortby_colname": "", (optional)
        # 	"display_positions_tablename": "" (optional)
        # }
        self.data_model_dic = self.load_data_model(dm_json_file_path)

    # TODO: exceptions
    @staticmethod
    def load_data_model(dm_json_file_path):
        data_model_dic = {}
        with open(dm_json_file_path, encoding='utf-8') as file:
            json_file_dic = json.load(file)

            for table_dic in (json_file_dic[MONOVALUED] + json_file_dic[MULTIVALUED]):
                tablename = table_dic[TABLENAME]
                data_model_dic[tablename] = {}
                data_model_dic[tablename][KEY_COLNAME] = table_dic[KEY_COLNAME]

                if isinstance(table_dic[VALUES_COLNAME], list):
                    # Monovaluated: values_colname is a list
                    data_model_dic[tablename][VALUES_COLNAME] = table_dic[VALUES_COLNAME]
                else:
                    # Multivalued: values_colname is a string
                    obj = dict()
                    obj[COLNAME] = table_dic[VALUES_COLNAME]
                    obj[DISPLAY_NAME] = table_dic[DISPLAY_NAME]

                    data_model_dic[tablename][VALUES_COLNAME] = [obj]

                    if SORBY_COLNAME in table_dic:
                        data_model_dic[tablename][SORBY_COLNAME] = table_dic[SORBY_COLNAME]
                    if LOOKUP_TABLENAME in table_dic:
                        data_model_dic[tablename][LOOKUP_TABLENAME] = table_dic[LOOKUP_TABLENAME]

        return data_model_dic

    @staticmethod
    def get_database_obj():
        return PostgresConnection(_host=secret.conn_host,
                                  _database=secret.conn_db,
                                  _user=secret.conn_user,
                                  _pass=secret.conn_pass)

    # IN: input_table_colname_list = ["tablename1.colname1", ...]
    # IN: input_filtered_node_list = [table1.col1.nodeValue, ...]
    # OUT:
    #    "nodes":[
    #       {
    #          "position":,
    #          "group":"",
    #          "name":""
    #       }, ...
    #    ]
    #    "links":[
    #       {
    #          "source":,
    #          "group":"",
    #          "target":,
    #          "value":
    #       }, ...
    #    ]
    #
    def get_data(self, input_table_colname_sorted_list, input_filtered_node_list, key_limit):
        data_dic = self._get_data_dic(input_table_colname_sorted_list, input_filtered_node_list)
        nodes_json, links_json = self._get_json_nodes_and_links(data_dic, input_table_colname_sorted_list, key_limit)

        return nodes_json, links_json

    # OUT: Dictionary with only the data that will show in diagram
    # data_dic{
    #     key: {
    #         col_name1: [sorted_value(s)],
    #         ...
    #     }
    # }
    def _get_data_dic(self, _input_table_colname_list, _input_filtered_node_list):

        # OUT: list of tuples as query result
        def get_query_result(_database_obj, _table_name, _colnames, _input_filtered_node_list):

            # OUT: str SQL query
            def get_filtering_query(_input_filtered_node_list):
                filtering_query = ''
                table_col_node_dic = {}
                for input_filtered_node in _input_filtered_node_list:
                    _tablename = input_filtered_node.split('.', 2)[0]
                    _colname = input_filtered_node.split('.', 2)[1]
                    node = input_filtered_node.split('.', 2)[2]

                    if _tablename not in table_col_node_dic:
                        table_col_node_dic[_tablename] = {}
                    if _colname not in table_col_node_dic[_tablename]:
                        table_col_node_dic[_tablename][_colname] = []
                    table_col_node_dic[_tablename][_colname].append(node)

                prev_tablename = ''
                prev_key_colname = ''
                for idx_table, _tablename in enumerate(table_col_node_dic):
                    __key_colname = self.data_model_dic[_tablename][KEY_COLNAME]
                    if idx_table == 0:
                        filtering_query = 'SELECT DISTINCT ' + _tablename + '.' + __key_colname
                        filtering_query += ' FROM ' + _tablename
                    else:
                        filtering_query += ' JOIN ' + _tablename + ' ON (' + prev_tablename + '.' + prev_key_colname + ' = ' + _tablename + '.' + __key_colname + ')'
                    prev_tablename = _tablename
                    prev_key_colname = __key_colname

                filtering_query += ' WHERE ('
                for idx_table, _tablename in enumerate(table_col_node_dic):
                    __key_colname = self.data_model_dic[_tablename][KEY_COLNAME]
                    if idx_table != 0:
                        filtering_query += ' AND ('
                    for idx_col, _colname in enumerate(table_col_node_dic[_tablename]):
                        if idx_col != 0:
                            filtering_query += ' AND ('
                        for idx_node, node in enumerate(table_col_node_dic[_tablename][_colname]):
                            if idx_node != 0:
                                filtering_query += ' AND ' + _tablename + '.' + __key_colname + ' IN (SELECT DISTINCT '
                                filtering_query += _tablename + '.' + __key_colname + ' FROM ' + _tablename + ' WHERE ' + _colname + " = '" + node + "')"
                            else:
                                filtering_query += _tablename + '.' + _colname + ' = ' + "'" + node + "'"
                        filtering_query += ')'

                return filtering_query

            _key_colname = self.data_model_dic[_table_name][KEY_COLNAME]

            cols_str = ', '.join(_colnames)

            query = 'SELECT ' + cols_str
            query += ' FROM ' + _table_name

            if _input_filtered_node_list:
                query += ' WHERE ' + _key_colname + ' IN (' + get_filtering_query(_input_filtered_node_list) + ')'

            if SORBY_COLNAME in self.data_model_dic[_table_name]:
                sortby_colname = self.data_model_dic[_table_name][SORBY_COLNAME]
                query += ' ORDER BY ' + _key_colname + ', ' + sortby_colname

            cur = _database_obj.get_cursor()
            cur.execute(query)

            return cur.fetchall()

        _data_dic = {}
        input_tables_dic = {}
        database_obj = self.get_database_obj()

        for table_colname in _input_table_colname_list:
            tablename = table_colname.split('.')[0]
            colname = table_colname.split('.')[1]

            if tablename not in input_tables_dic:
                input_tables_dic[tablename] = []
            input_tables_dic[tablename].append(tablename + '.' + colname)

        for tablename in input_tables_dic:
            key_idx = 0
            key_colname = tablename + '.' + self.data_model_dic[tablename][KEY_COLNAME]
            colnames = [key_colname]

            for colname in input_tables_dic[tablename]:
                colnames.append(colname)

            tuples = get_query_result(database_obj, tablename, colnames, _input_filtered_node_list)

            for _tuple in tuples:
                key = _tuple[key_idx]

                if key not in _data_dic:
                    _data_dic[key] = {}

                for idx, colname in enumerate(colnames):
                    if idx != 0:
                        value = _tuple[idx]

                        if colname not in _data_dic[key]:
                            _data_dic[key][colname] = []

                        _data_dic[key][colname].append(value)

        return _data_dic

    def _get_json_nodes_and_links(self, data_dic, input_table_colname_list, key_limit):

        def update_nodes_n_links(_nodes_pos_dic, _nodes_filtered, _links_filtered):
            _nodes_updated = []
            empty_node_indexes = []
            _links_updated = _links_filtered

            for _idx, node_key in enumerate(list(_nodes_pos_dic.keys())):
                if node_key not in _nodes_filtered:
                    # Saves the index of an empty node
                    empty_node_indexes.append(_idx)
                else:
                    # Saves the node
                    _nodes_updated.append(
                        {
                            "name": node_key.split('.')[2],
                            "group": node_key.replace(' ', '_'),
                            "key": node_key,
                            "position": _nodes_pos_dic[node_key]["position"]
                        }
                    )
            # Updates source/target indexes on links
            for i in reversed(empty_node_indexes):
                for link in _links_updated:
                    if link.get("source") > i:
                        link["source"] = link.get("source") - 1
                    if link.get("target") > i:
                        link["target"] = link.get("target") - 1

            return _nodes_updated, _links_updated

        def filter_nodes_n_links(_nodes_pos_dic, _links_matrix, _key_limit):
            nodes_list = list(_nodes_pos_dic.keys())
            _nodes_filtered = []
            _links_filtered = []

            for source_idx, row in enumerate(_links_matrix):
                for target_idx, value in enumerate(row):
                    value = _links_matrix[source_idx][target_idx]
                    if value > _key_limit:
                        if nodes_list[source_idx] not in _nodes_filtered:
                            _nodes_filtered.append(nodes_list[source_idx])
                        if nodes_list[target_idx] not in _nodes_filtered:
                            _nodes_filtered.append(nodes_list[target_idx])

                        _links_filtered.append(
                            {
                                "source": source_idx,
                                "target": target_idx,
                                "value": _links_matrix[source_idx][target_idx],
                                "group": nodes_list[source_idx].replace(' ', '_')
                            }
                        )

            return _nodes_filtered, _links_filtered

        def get_links_matrix(_data_dic, _nodes_pos_dic, _input_table_colname_list):
            # matrix initialization
            matrix = [[0 for x in range(len(_nodes_pos_dic))] for y in range(len(_nodes_pos_dic))]
            nodes_key_list = list(_nodes_pos_dic.keys())

            for key in _data_dic:
                prev = None

                for table_col_name in _input_table_colname_list:
                    if table_col_name in _data_dic[key]:
                        for value in _data_dic[key][table_col_name]:
                            value_key = table_col_name + "." + value
                            if prev:
                                source = nodes_key_list.index(prev)
                                target = nodes_key_list.index(value_key)
                                matrix[source][target] += 1
                            prev = value_key

            return matrix

        # nodes_pos_dic: {
        #     "tablenameX.col_name1.node_name1": {
        #         "position": x
        #     },
        #     "tablenameY.col_name2.node_name2": {
        #         "position": y
        #     }
        #     ...
        #     "tablenameZ.col_name_N.node_name_N": {
        #         "position": z
        #     }
        # }
        def get_nodes(_data_dic, _sorted_colnames):
            # OUT:
            # positions_dic{
            #     tablename.col_name1: position,
            #     tablename.col_name2: position,
            #     tablename.col_name3: {
            #         value1: position1,
            #         value2: position2,
            #         ...
            #         value_N: position_N
            #     },
            #     ...
            #     tablename.col_name_N: {
            #         value1: position1,
            #         value2: position2,
            #         ...
            #         value_N: position_N
            #     }
            # }
            def get_node_positions_dic(_sorted_colnames):
                # OUT:
                # values_position_dic = {
                #     "value1": position1,
                #     "value2": position2,
                #     ...
                #     "value_N": position_N
                # }
                def get_values_position_from_lookup_table(_lookup_table_name, _posicion_base):
                    query = 'SELECT ' + LUP_VALUE + ', ' + LUP_POSITION
                    query += ' FROM ' + _lookup_table_name

                    cur = database_obj.get_cursor()
                    cur.execute(query)

                    tuples = cur.fetchall()  # TUPLA[LUP_VALUE, LUP_POSITION]

                    values_position_dic = {}
                    _size = 0
                    for _tuple in tuples:
                        values_position_dic[_tuple[0]] = int(_tuple[1]) + _posicion_base
                        if _tuple[1] > _size:
                            _size = _tuple[1]
                    return _size + 1, values_position_dic

                database_obj = self.get_database_obj()

                _positions_dic = {}
                base_position = 0
                for col in _sorted_colnames:
                    tablename = col.split('.')[0]
                    # colname = table_colname.split('.')[1]
                    if LOOKUP_TABLENAME in self.data_model_dic[tablename]:
                        lookup_table_name = self.data_model_dic[tablename][LOOKUP_TABLENAME]
                        size, dic = get_values_position_from_lookup_table(lookup_table_name, base_position)
                        _positions_dic[col] = dic
                        base_position += size
                    else:
                        _positions_dic[col] = base_position
                        base_position += 1

                return _positions_dic

            positions_dic = get_node_positions_dic(_sorted_colnames)

            _node_pos_dic = {}
            for key in _data_dic:
                for column in _data_dic[key]:
                    for value in _data_dic[key][column]:
                        key_n_value = column + "." + value
                        if key_n_value not in _node_pos_dic:

                            _node_pos_dic[key_n_value] = {}
                            if str(type(positions_dic[column])) == "<class 'dict'>":
                                _node_pos_dic[key_n_value]["position"] = positions_dic[column][value]
                            elif str(type(positions_dic[column])) == "<class 'int'>":
                                _node_pos_dic[key_n_value]["position"] = positions_dic[column]

            return _node_pos_dic

        # Step 1: Establish the all the nodes position based on 'data_model_dic.json'
        nodes_pos_dic = get_nodes(data_dic, input_table_colname_list)

        # Step 2: Create the link's matrix that represent each origin/destiny link
        links_matrix = get_links_matrix(data_dic, nodes_pos_dic, input_table_colname_list)

        # Step 3: Filter links and nodes that do not surpass the 'dni_limit' parameter
        nodes_filtered, links_filtered = filter_nodes_n_links(nodes_pos_dic, links_matrix, key_limit)

        # Step 4: Update source/target indexes on links creating a list without empty nodes
        nodes_updated, links_updated = update_nodes_n_links(nodes_pos_dic, nodes_filtered, links_filtered)

        return json.dumps(nodes_updated, ensure_ascii=False), json.dumps(links_updated, ensure_ascii=False)
