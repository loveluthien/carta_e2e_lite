This is a lightweight end-to-end testing framework for CARTA. The goal is to ensure that all functions in CARTA's widgets and dialogs are working as expected. This test doesn't include the performance of the functions, but rather checks if the functions are working correctly. The test framework is designed to be lightweight and easy to use, allowing developers to quickly write and run tests for their code.

# Guidelines for End-to-End Tests
- Tests should check the states and also the rendered images, profiles, and other visual elements.
- Check the interaction between testing functions of widgets and other widgets and dialogs.
- Every test should check if the function works on rendered components like the image viewer and profilers.
- Failed cases need to be tested.
- Take PNG snapshots if the test related to image viewer and profiler.
- Generate lightweight mock data for testing.
- All the buttons on widgets and dialogs should be tested.
- Update the test plan in `test-plans` when new tests are added or tests are modified.
- Check the RGB values of rendered components and ensure they match the expected values.
