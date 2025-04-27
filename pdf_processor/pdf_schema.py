from pulsar.schema import Record, String
class PDFInfo(Record):
    url = String()
    source = String()
    title = String()
    authors = String()
    summary = String()