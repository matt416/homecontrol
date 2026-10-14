#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build/host-tests
javac -d build/host-tests src/org/homecontrol/frame/PhotoOrder.java src/org/homecontrol/frame/PairingCode.java tests/PhotoOrderTests.java tests/PairingCodeTests.java
java -cp build/host-tests org.homecontrol.frame.PhotoOrderTests
java -cp build/host-tests org.homecontrol.frame.PairingCodeTests
