var gulp = require('gulp');
var uglify = require('gulp-uglify');
var watch = require('gulp-watch');
var clean = require('gulp-clean');
var rename = require('gulp-rename');

gulp.task('clean', function () {
    return gulp
    .src('./public', {read: false})
    .pipe(clean());
});

gulp.task('move', ['clean'], function() {
    return gulp
    .src('./build/**/*')
    .pipe(gulp.dest('./public'));
});

gulp.task('snapmin', ['move'], function() {
    return gulp
    .src('./public/js/Snap.js')
    .pipe(uglify())
    .pipe(rename('Snap.min.js'))
    .pipe(gulp.dest('./public/js/'));
});

gulp.task('default', ['snapmin'], function() {
});

gulp.task('dev', ['snapmin'], function() {
    return gulp.watch('./build/**/*', ['default']);
});
