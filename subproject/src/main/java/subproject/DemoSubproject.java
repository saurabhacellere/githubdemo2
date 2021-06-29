package subproject;

public class DemoSubproject {

	public static void main(String[] args) {
		int k_subproject;
		
	}
	
	private static DemoSubproject foo = null;
	
	
	//multiple simultaneous callers may see partially initialized objects

 public static DemoSubproject getFoo() { 
	    System.out.println("");
	    System.out.println("");
	    System.out.println(""); 
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");  
	          
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println(""); 
	    
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println(""); 
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
	    System.out.println("");
     if (foo==null) {
         foo = new DemoSubproject();
     }
    return foo; 
 }

 public static DemoSubproject getFoo2() {
     if (foo==null) {
         foo = new DemoSubproject();
     }
    return foo;
 }
 
}
