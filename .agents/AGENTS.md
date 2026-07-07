
## Rule 41
AuthService không du?c bi?t SMTP, Redis, Prisma, Date, Logger tr?c ti?p. Ch? bi?t interface.

## Rule 42
M?i dependency ph?i inject. Không new. Không singleton.

## Rule 43
Không g?i Repository t? Controller.

## Rule 44
Không g?i Mail t? AuthService. Publish Event.

## Rule 45
Business Logic không du?c ph? thu?c Framework. NestJS ch? là Adapter. N?u b? NestJS, Business v?n ch?y.

## Rule 46
M?i commit d?u ph?i có:
* Unit Test
* Integration Test (n?u ?nh hu?ng DB)
* Architectural Verification (ki?m tra không vi ph?m dependency)
* Documentation update
N?u thi?u m?t trong b?n thì commit chua hoàn thành.

