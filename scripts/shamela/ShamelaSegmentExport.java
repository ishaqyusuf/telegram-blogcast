// Run on a copied official archive segment with Lucene 10.4 and Java 21+.
// Package membership is required by Lucene's segment reader constructor.
package org.apache.lucene.index;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.io.BufferedWriter;
import org.apache.lucene.store.FSDirectory;
import org.apache.lucene.store.IOContext;

public class ShamelaSegmentExport {
    private static String quote(String value) {
        StringBuilder result = new StringBuilder("\"");
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"': result.append("\\\""); break;
                case '\\': result.append("\\\\"); break;
                case '\n': result.append("\\n"); break;
                case '\r': result.append("\\r"); break;
                case '\t': result.append("\\t"); break;
                default:
                    if (c < 32) result.append(String.format("\\u%04x", (int)c));
                    else result.append(c);
            }
        }
        return result.append('"').toString();
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 3) throw new IllegalArgumentException("index-folder segment-name output.jsonl");
        try (var dir = FSDirectory.open(Path.of(args[0]))) {
            var infos = SegmentInfos.readLatestCommit(dir);
            SegmentCommitInfo target = null;
            for (var info : infos) if (info.info.name.equals(args[1])) target = info;
            if (target == null) throw new IllegalArgumentException("Segment not found");
            try (var reader = new SegmentReader(target, infos.getIndexCreatedVersionMajor(), IOContext.DEFAULT);
                 BufferedWriter output = Files.newBufferedWriter(Path.of(args[2]), StandardCharsets.UTF_8)) {
                var stored = reader.storedFields();
                var live = reader.getLiveDocs();
                int count = 0;
                for (int i = 0; i < reader.maxDoc(); i++) {
                    if (live != null && !live.get(i)) continue;
                    var doc = stored.document(i);
                    output.write("{");
                    boolean first = true;
                    for (var field : doc.getFields()) {
                        String value = field.stringValue();
                        if (value == null && field.numericValue() != null) value = field.numericValue().toString();
                        if (value == null) continue;
                        if (!first) output.write(",");
                        output.write(quote(field.name()) + ":" + quote(value));
                        first = false;
                    }
                    output.write("}\n");
                    count++;
                }
                System.out.println("Exported " + count + " live documents from " + args[1]);
            }
        }
    }
}
