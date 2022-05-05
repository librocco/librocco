#!/usr/bin/env python3
"""
Download the CSV catalog from Zanichelli publisher, fix its encoding (to be UTF-8) and save it.
This is a python file because it's faster for me, right now, to write this in python.
Feel free to reimplement in Typescript!
"""
import sys
import csv
import xlrd
import urllib.request


URL = "http://listinoscuola.rizzolieducation.it/Listino%20Rizzoli%20Education%20per%20sito.xls"

FIELDS = [
    "publisher",
    "title",
    "author",
    "distributor_code",
    "isbn",
    "school",
    "price",
    "notes"
]
def main(destination):
    response = urllib.request.urlopen(URL)
    data = response.read()
    wb = xlrd.open_workbook(file_contents=data)
    sheet = wb.sheet_by_index(0)
    i = 3
    next_row = sheet.row_values(i)
    books = []
    while True:
        book_info = dict(zip(FIELDS, next_row))
        books.append(book_info)
        try:
            i += 1
            next_row = sheet.row_values(i)
        except IndexError:
            break
    # Write the CSV file with all book infos
    with open(destination, 'w', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(books)


if __name__ == '__main__':
    destination = sys.argv[1]
    print(f"Downloading CSV to {destination}")
    main(destination=destination)
