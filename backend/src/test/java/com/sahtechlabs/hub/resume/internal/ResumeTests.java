package com.sahtechlabs.hub.resume.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.assertj.core.api.Assertions.assertThatIllegalStateException;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

class ResumeTests {

    private static final Instant UPLOADED = Instant.parse("2026-10-05T12:00:00Z");

    @Test
    void aNewUploadIsActiveAndHasNoIdUntilSaved() {
        Resume resume = Resume.createActive("cv.pdf", "key.pdf", UPLOADED);

        assertThat(resume.active()).isTrue();
        assertThat(resume.id()).isNull();
        assertThatIllegalStateException().isThrownBy(resume::savedId);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   "})
    void rejectsABlankFilename(String filename) {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> Resume.createActive(filename, "key.pdf", UPLOADED))
                .withMessageContaining("filename");
    }

    @Test
    void rejectsAFilenameLongerThanTheColumn() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> Resume.createActive("a".repeat(256), "key.pdf", UPLOADED))
                .withMessageContaining("filename");
    }

    @Test
    void rejectsABlankStorageKey() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> Resume.createActive("cv.pdf", " ", UPLOADED))
                .withMessageContaining("storageKey");
    }

    @ParameterizedTest
    @CsvSource({
        "cv.pdf, cv.pdf",
        "C:\\Users\\me\\Documents\\cv.pdf, cv.pdf",
        "../../etc/cv.pdf, cv.pdf",
        "'  Jane Doe CV.pdf  ', Jane Doe CV.pdf",
        "'/', resume.pdf"
    })
    void keepsOnlyTheLastPathSegmentOfTheUploadedName(String original, String expected) {
        assertThat(ResumeService.displayName(original)).isEqualTo(expected);
    }

    @ParameterizedTest
    @NullSource
    void fallsBackToAGenericNameWhenTheClientSendsNone(String original) {
        assertThat(ResumeService.displayName(original)).isEqualTo("resume.pdf");
    }

    @Test
    void stripsControlCharactersThatWouldBreakTheDownloadHeader() {
        assertThat(ResumeService.displayName("cv\r\nX-Injected: 1.pdf")).isEqualTo("cvX-Injected: 1.pdf");
    }
}
