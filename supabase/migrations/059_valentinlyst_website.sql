-- Migration 059: Set google_website for Valentinlyst Senter

UPDATE pois
SET google_website = 'https://valentinlyst.no/'
WHERE id = 'google-ChIJnW_zJ20xbUYRqaLffSVJpgY';
