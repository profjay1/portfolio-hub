package com.sahtechlabs.hub.projects.internal;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.jspecify.annotations.Nullable;

/**
 * An optional link: absent (null or blank) is fine, otherwise it must satisfy {@link HttpUrls#isValid}. Not
 * Hibernate's {@code @URL}, which accepts any scheme, including {@code javascript:}.
 */
@Documented
@Constraint(validatedBy = HttpUrl.Validator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
@interface HttpUrl {

    String message() default "must be an absolute http(s) URL";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<HttpUrl, String> {

        @Override
        public boolean isValid(@Nullable String value, ConstraintValidatorContext context) {
            return value == null || value.isBlank() || HttpUrls.isValid(value);
        }
    }
}
