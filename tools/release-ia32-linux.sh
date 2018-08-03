#Version of rebuild.sh with explicit compilation with gcc-4.8
#You must install gcc-4.8 and g++-4.8 

#ARCH=`node -e "console.log(process.arch+'-'+process.platform)"`
ARCH="ia32-linux"

echo "Building for ${ARCH}" 
export CFLAGS=-m32
cd ..; CC=gcc-4.8 CXX=g++-4.8 node-gyp --release rebuild --arch=ia32; 
cd tools;
cp ../build/Release/WishApi.node ../bin/WishApi-${ARCH}.node;
strip ../bin/WishApi-${ARCH}.node;

