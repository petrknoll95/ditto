## Subresource Integrity

If you are loading Highlight.js via CDN you may wish to use [Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity) to guarantee that you are using a legimitate build of the library.

To do this you simply need to add the `integrity` attribute for each JavaScript file you download via CDN. These digests are used by the browser to confirm the files downloaded have not been modified.

```html
<script
  src="//cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/highlight.min.js"
  integrity="sha384-pGqTJHE/m20W4oDrfxTVzOutpMhjK3uP/0lReY0Jq/KInpuJSXUnk4WAYbciCLqT"></script>
<!-- including any other grammars you might need to load -->
<script
  src="//cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/languages/go.min.js"
  integrity="sha384-Mtb4EH3R9NMDME1sPQALOYR8KGqwrXAtmc6XGxDd0XaXB23irPKsuET0JjZt5utI"></script>
```

The full list of digests for every file can be found below.

### Digests

```
sha384-qimhSkVWof5rfaFajQk8KAtzSRYyIArcJCMKWdDcNq34F4uplk08wmEyUiYLmO+3 /es/languages/c.js
sha384-5fESKgrRcGs7I/89bn7NKFcHyvIVcmQIG4JfCEAV5Rg5VVtskrmGkHVOIsD1642v /es/languages/c.min.js
sha384-eM9Op3b0ilZ/iW7jeVAMo//MKcEXHCbg1Vf8SMrqds5LIOeF9+3qaX//TsnbItae /es/languages/cpp.js
sha384-+tDHTmLKfBxXgVksRhLEJM4z9PfcGQ2XsrZMDcdJ1SIlPZrtAR4+m4XUX+zJf5nf /es/languages/cpp.min.js
sha384-prYrGnTm7oh5PuKMqLmR+7SrkN+R30qFCvQLyWRjl7bJqveap4Mb3RDeCe84KHSC /es/languages/kotlin.js
sha384-yM8aIXHTDq77S7Ar7r/O8Ix2yH07cPC1z48Qh6HBzcG2+plE8YMQn9goknWvawaH /es/languages/kotlin.min.js
sha384-LZ+YGF0Xve9sHzC9G37Kc14gDC6lfDpny2hggVJVfHb+OsTEXgMGLmAWUJzi4YRC /es/languages/rust.js
sha384-/ktfWRgwL+kZAZeeXDl9mwkD/3atjwjkzLCCoSHtME7MzP87wMhUmNUZ83AoqYx2 /es/languages/rust.min.js
sha384-5tfPU5gS6J1PWMpLzFJzYt4O09dEwu0Ie9HPKYUQ43EE25lVsyugx9jVH0VViMor /es/languages/swift.js
sha384-a+qBlyBQMw6U8FrlXL2OodB7uR5S1diebujSfAM76WdYSl3ydnlxf8MCpGaiGgWG /es/languages/swift.min.js
sha384-WHdxyD51Y+ytDdcYGVkKHQOThUwwhLl/1GvZxHTHL4ImI4NS32L/B8bvB/1zN/Mk /languages/c.js
sha384-jtwnwOYA+K4zYN55fA4z4U0PTK5oEp4RcLYaXkYRKO3UUzge1o21ArmvKmTRdh/d /languages/c.min.js
sha384-M2wpTxQe2N0750xYZ0zTinwbmjsZjdtuS7twUUP2dxtHR0YqhY3JuUFyyhANf9Uy /languages/cpp.js
sha384-/yf54L01PbO6NtVs1Pu9rgfNHbKXanLdNcGVuNa0m5+KiyH+1NpZRDK6idm5VoVl /languages/cpp.min.js
sha384-Ve7wqoYcjaWimhzLnfK0sj2Lij8DmxK2diJ9kazkpifUrd7O+b2CbnHSxD3SCzqj /languages/kotlin.js
sha384-s0inyAR7LE5SVvn9VCZrQaiUxkDi+RsQdSKzFh2CjWf+LFd01DAjt9wtxGhT+4qT /languages/kotlin.min.js
sha384-rCXn7K5j/lD2PrSex2XCqyLKap2Ibnsls0uQCx4ZaezI1FJ5RYvoWcsAl/v8SKlE /languages/rust.js
sha384-VTNxHMz2AmpHxzSm8SvRI0As5+wID2j2XJBFtWTic2iEK8WbXgR1fymVQS9S2DvY /languages/rust.min.js
sha384-avfxrZ7nwXDWWFaYzhYylhlr8UCb5MOAoBoIxEYvDmPl2iPfA/4qk4jrIYdyGVA0 /languages/swift.js
sha384-TfALNLT6HJzZieazgsVvFM0DzFWQsgl0d7mdwPLyg1yg7XE4QwLY4jqmJRNnI1S4 /languages/swift.min.js
sha384-9+zYv9MojpDrvE7xDHVYJv7jFC/p7yUBEmv/MduyOWc8FzMexPVFb4N0hU9Xzowf /highlight.js
sha384-DK5T7ZV1Vf++Pg3kS2z+cqfvLeyXGPMK6u2dRwwLdQeP50J/GecJNO87IxzKdk5j /highlight.min.js
```

