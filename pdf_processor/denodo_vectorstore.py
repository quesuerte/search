from langchain_core.vectorstores import VectorStore
import base64
from adbc_driver_flightsql import DatabaseOptions
from adbc_driver_flightsql.dbapi import connect
from langchain_core.documents import Document
from typing import List
from langchain_core.embeddings import Embeddings
import json
import sqlglot

class DenodoVector(VectorStore):
    def __init__(self, embedding_model: Embeddings, connection_param, collection_name, metadata):
        self.embedding_model = embedding_model
        self.connection_param = connection_param
        self.collection_name = collection_name
        self.metadata = metadata

    @property
    def embeddings(self) -> Embeddings:
        return self.embedding_model
    
    @classmethod
    def from_documents(cls, documents: List[Document], embedding: Embeddings, collection_name, connection_param,  db_name, metadata: List[str]=[['metadata','VARCHAR(4000)'],['text','VARCHAR(4000)'],['embedding','VECTOR(1536)']], db_db=None, db_catalog=None, db_schema=None, create_index=True) -> VectorStore:
        results = [(json.dumps(d.metadata),d.page_content) for d in documents]
        return cls.from_query(results=results,
                              embedding=embedding,
                              collection_name=collection_name, 
                              connection_param=connection_param,
                              db_db=db_db, 
                              db_name=db_name,
                              metadata=metadata, 
                              db_catalog=db_catalog, 
                              db_schema=db_schema,
                              create_index=create_index)

    @classmethod
    def from_texts(cls, texts: List[str], embedding: Embeddings,collection_name, connection_param,  db_name, metadata: List[str]=[['text','VARCHAR(4000)'],['embedding','VECTOR(1536)']], db_db=None, db_catalog=None, db_schema=None, create_index=True) -> VectorStore:
        results = list(zip(texts))
        return cls.from_query(results=results,
                              embedding=embedding,
                              collection_name=collection_name,
                              connection_param=connection_param,
                              db_name=db_name,
                              metadata=metadata,
                              db_db=db_db,
                              db_catalog=db_catalog,
                              db_schema=db_schema,
                              create_index=create_index)
    
    @classmethod
    def from_query(cls, results, embedding: Embeddings,collection_name,connection_param, db_name, metadata: List[str]=[['text','VARCHAR(4000)'],['embedding','VECTOR(1536)']], db_db=None, db_catalog=None,db_schema=None, create_index=True) -> VectorStore:
        if db_db is None:
            db_db = connection_param['db']
        create_remote_table(collection_name,connection_param, db_name, metadata, db_db, db_catalog,db_schema, create_index)
        print("Created remote table")
        insert_records(embedding, connection_param, collection_name, results, metadata)
        return cls(embedding_model=embedding,
                   connection_param=connection_param,
                   collection_name=collection_name,
                   metadata=metadata)
    
    @classmethod
    def init(cls, embedding: Embeddings,collection_name,connection_param, db_name, metadata: List[str]=[['text','VARCHAR(4000)'],['embedding','VECTOR(1536)']], db_db=None, db_catalog=None,db_schema=None, create_index = True) -> VectorStore:
        create_remote_table(collection_name,connection_param,db_name,metadata,db_db,db_catalog,db_schema,create_index, remote_should_exist=True)
        return cls(embedding_model=embedding,
                   connection_param=connection_param,
                   collection_name=collection_name,
                   metadata=metadata)

    def add_documents(self, documents: List[Document], db_db=None) -> VectorStore:
        results = [(json.dumps(d.metadata),d.page_content) for d in documents]
        self.add_query(results=results, db_db=db_db)

    def add_query(self, results, db_db=None):
        if db_db is None:
            db_db = self.connection_param['db']
        self.insert_records(self.embedding,self.connection_param,self.collection_name,results,self.metadata)

    

    @classmethod
    def from_existing_index(cls, embedding: Embeddings, collection_name, connection_param, metadata) -> VectorStore:
        with create_denodo_connection(connection_param) as con:
            with con.cursor() as cur:
                if not underlying_view_exists(cur,connection_param['db'],collection_name):
                    raise Exception(f"Underlying view {connection_param['db']}.{collection_name} does not exist--please create this collection before performing operations on it")
        return cls(embedding_model=embedding, 
                   connection_param=connection_param, 
                   collection_name=collection_name, 
                   metadata=metadata)

    def similarity_search(self, query: str, top_k: int=10) -> List[Document]:
        query_embedding = self.embedding_model.embed_query(query)
        column_names = [row[0] for row in self.metadata]
        string_emb = str(query_embedding)
        query = f"SELECT VECTOR_DISTANCE(embedding,'{string_emb}'), {','.join(column_names[:-1])}  FROM {self.collection_name} ORDER BY VECTOR_DISTANCE(embedding,'{string_emb}') ASC LIMIT {top_k}"
        with create_denodo_connection(self.connection_param) as con:
            with con.cursor() as cur:
                if not underlying_view_exists(cur,self.connection_param['db'],self.collection_name):
                    raise Exception(f"Underlying view {self.connection_param['db']}.{self.collection_name} does not exist--please create this collection before performing operations on it")
                # Denodo does not have a vector type yet, must convert it to a string
                
                cur.execute(query)
                results = cur.fetchallarrow().to_pandas()
                description = cur.description

        for idx in range(len(description)):
            if description[idx][0] == 'metadata':
                doc_iter = [(row[idx], row[-1]) for row in results.itertuples(False)]
                return [Document(page_content=val[1],metadata = json.loads(val[0])) for val in doc_iter]

        return [Document(page_content=row[-1],metadata = {"source": "text"}) for row in results]
    
    def clear_index(self):
        with create_denodo_connection(self.connection_param) as con:
            with con.cursor() as cur:
                if not underlying_view_exists(cur,self.connection_param['db'],self.collection_name):
                    raise Exception(f"Underlying view {self.connection_param['db']}.{self.collection_name} does not exist--please create this collection before performing operations on it")
                cur.execute(f"DELETE FROM {self.collection_name}",)
                cur.fetchallarrow()

    def delete_index(self):
        with create_denodo_connection(self.connection_param) as con:
            with con.cursor() as cur:
                if not underlying_view_exists(cur,self.connection_param['db'],self.collection_name):
                    raise Exception(f"Underlying view {self.connection_param['db']}.{self.collection_name} does not exist--please create this collection before performing operations on it")
                cur.execute(f"SELECT * FROM DROP_REMOTE_TABLE('{self.connection_param['db']}','{self.collection_name}')")
                cur.fetchallarrow()

def create_remote_table(collection_name,connection_param, db_name, metadata: List[str]=[['text','VARCHAR(4000)'],['embedding','VECTOR(1536)']], db_db=None, db_catalog=None,db_schema=None, create_index = True, remote_should_exist=False):
    if db_db is None:
        db_db = connection_param['db']
    column_names = [row[0] for row in metadata]
    column_list = ",".join([row[0] + " " + row[1] for row in metadata])

    create_remote_table_schema = f"CREATE TABLE {collection_name} ({column_list})"
    # Note that this only works for pgvector so far
    if create_index is True:
        create_remote_table_schema += f"; CREATE INDEX ON {collection_name} USING hnsw ({column_names[-1]} vector_cosine_ops); --@{{internal_parameter_columns}} @{{internal_parameter_table_name}}"
    else:
        create_remote_table_schema += "--@{internal_parameter_columns} @{internal_parameter_table_name}"
    create_remote_table_query = "SELECT " + ','.join(map(lambda x: "'" + x + "'" + f" as {x}",column_names)) + " LIMIT 0"
    create_remote_table = f"SELECT * FROM CREATE_REMOTE_TABLE({to_sql_literal(collection_name)}, false, {to_sql_literal(create_remote_table_query)}, {to_sql_literal(db_db)}, {to_sql_literal(db_name)}, {to_sql_literal(db_catalog)}, {to_sql_literal(db_schema)}, {to_sql_literal(connection_param['db'])}, {to_sql_literal(collection_name)}, null, false, null, {to_sql_literal(create_remote_table_schema)})"
    with create_denodo_connection(connection_param) as con:
        with con.cursor() as cur:
            if remote_should_exist:
                if not underlying_view_exists(cur,connection_param['db'],collection_name):
                    raise Exception(f"Underlying view {connection_param['db']}.{collection_name} does not exist--please create this collection before performing operations on it")
            else:
                if underlying_view_exists(cur,connection_param['db'],collection_name):
                    raise Exception(f"Underlying view {connection_param['db']}.{collection_name} already exists--please drop this view or change the name of the collection")
            cur.execute(create_remote_table)
            cur.fetchallarrow()

def to_sql_literal(value):
    return sqlglot.expressions.convert(value).sql()

def insert_records(embedding,connection_param, collection_name, results,metadata):
    sql_literals = [tuple(map(to_sql_literal,row)) for row in results]
    input_emb_values = [str(d[-1]) for d in results]
    column_names = [row[0] for row in metadata]
    column_list = ",".join([row[0] + " " + row[1] for row in metadata])
    import time
    print("Embedding documents...")
    emb_start_time = time.time()
    emb_values = list(map(lambda x: ("'" + str(x) + "'",),embedding.embed_documents(texts=input_emb_values)))
    emb_end_time = time.time()
    print(f"Completed embedding documents in {emb_end_time - emb_start_time} seconds.")
    
    from queue import Queue
    import multiprocessing
    from threading import Thread

    cores = multiprocessing.cpu_count()
    insert_queue = Queue()
    insert_values = [tuple(res) + tuple(emb) for res, emb in zip(sql_literals, emb_values)]
    column_insert_list = ','.join(column_names)
    
    batch_size = 25
    total_rows = len(insert_values)
    for idx in range(0,total_rows,batch_size):
        start = idx
        end = idx + batch_size
        if idx + batch_size > total_rows:
            end = total_rows - 1
        values_parameterized = ',\n'.join(['('+','.join(row)+')' for row in insert_values[start:end]])
        query = f"INSERT INTO {collection_name} ({column_insert_list}) VALUES {values_parameterized}"
        insert_queue.put(query)

    print("Starting insert of documents into Denodo")
    insert_start_time = time.time()
    def thread_task(inq,con,core):
        while True:
            with con.cursor() as cur:
                param = inq.get()
                if param is None:
                    inq.task_done()
                    con_queue.put(con)
                    break
                cur.execute(param)
                cur.fetchallarrow()
            inq.task_done()

    con = create_denodo_connection(connection_param)
    con_queue = Queue()
    for core in range(1,cores):
        insert_queue.put(None)
        con_queue.put(None)

    join_list = []
    for core in range(1,cores):
        worker = Thread(target=thread_task, args=(insert_queue,con.adbc_clone(),core))
        worker.start()
        join_list.append(worker)
            
    for thread in join_list:
        thread.join()

    while not con_queue.empty():
        connection = con_queue.get()
        if connection is None:
            con_queue.task_done()
            break
        connection.close()
        con_queue.task_done()
    con.close()
    insert_end_time = time.time()
    print(f"Completed inserting documents in {insert_end_time - insert_start_time} seconds")

def denodo_connection_param_oauth(oauth_token,host,db,port):
        return {'oauth_token': oauth_token, 'host': host, 'db': db, 'port': port}

def denodo_connection_param(user,password,host,db,port):
        return {'user': user, 'password': password, 'host': host, 'db': db, 'port': port}

def create_denodo_connection(connection_param):
    # Just loading the driver into the underlying image and then customizing the DSN from here seems easier. This is part of the DSN that won't change depending on auth
    auth_header = ""
    if 'oauth_token' in connection_param:
        auth_header = f"Bearer {connection_param['oauth_token']}"
    else:
        basic_auth = base64.b64encode(f"{connection_param['user']}:{connection_param['password']}".encode('utf-8')).decode('utf-8')
        auth_header = f"Basic {basic_auth}"
    
    return connect(
        f"grpc://{connection_param['host']}:{connection_param['port']}",
        db_kwargs={
            DatabaseOptions.AUTHORIZATION_HEADER.value: auth_header,
            "adbc.flight.sql.rpc.call_header.database": connection_param['db'],
            "adbc.flight.sql.rpc.call_header.timePrecision": 'milliseconds',
        }, autocommit=True)

def underlying_view_exists(cursor, db, collection_name):
    cursor.execute(f"SELECT 1 FROM GET_VIEWS() WHERE input_database_name = '{db}' AND input_name = '{collection_name}'")
    if cursor.fetchone() is not None:
        return True
    return False