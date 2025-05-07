from pulsar.schema import Record, String
class PDFInfo(Record):
    url = String()
    content_type = String()
    source = String()
    title = String()
    authors = String()
    summary = String()