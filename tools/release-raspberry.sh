#Version of rebuild.sh with explicit compilation with gcc-4.8
#You must install gcc-4.8 and g++-4.8 

#ARCH=`node -e "console.log(process.arch+'-'+process.platform)"`
ARCH="arm-linux"

echo "Building for ${ARCH}" 
cd ..; 
CC=arm-linux-gnueabihf-gcc-4.8 CXX=arm-linux-gnueabihf-g++-4.8 node-gyp rebuild --arch=armv7; 
cd tools; 
cp ../build/Release/WishApi.node ../bin/WishApi-${ARCH}.node; 
arm-linux-gnueabihf-strip ../bin/WishApi-${ARCH}.node; 

