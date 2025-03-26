from pulsar.schema import Record, String
class PDFInfo(Record):
    url = String()
    title = String()
    authors = String()
    summary = String()