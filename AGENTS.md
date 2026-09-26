This is a lightweight end-to-end testing framework for CARTA. The goal is to ensure that all functions in CARTA's widgets and dialogs are working as expected. This test doesn't include the performance of the functions, but rather checks if the functions are working correctly. The test framework is designed to be lightweight and easy to use, allowing developers to quickly write and run tests for their code.

# Guidelines for Writing End-to-End Tests
- Tests should check the states and also the rendered images, profiles, and other visual elements like test and values in overlays.
- Every test should check if the function works on image viewer and profilers.
- Failed cases need to be tested.
- Take PNG snapshots if the test related to image viewer and profiler.
- Generate lightweight mock data for testing.
- All the buttons on widgets and dialogs should be tested.
